import json
import os
import time
import asyncio
from typing import Dict, Optional, Tuple

import dotenv
from openai import OpenAI

from app.core.redis_cache import cache
from app.schemas.chat import Message
from app.schemas.risk_profile import LLMGoalData

dotenv.load_dotenv()


# Получаем все API ключи из .env
def _get_api_keys():
    """Получает все API ключи из .env"""
    keys = []
    i = 1
    while True:
        # First key can be stored as OPENROUTER_API_KEY (or _1 for legacy naming)
        key_name = "OPENROUTER_API_KEY" if i == 1 else f"OPENROUTER_API_KEY_{i}"
        key_value = os.environ.get(key_name) or (
            os.environ.get("OPENROUTER_API_KEY_1") if i == 1 else None
        )
        if key_value:
            keys.append(key_value)
            i += 1
        else:
            break
    return keys


API_KEYS = _get_api_keys()
current_key_index = 0


def _get_client():
    """Создает клиент с текущим API ключом"""
    if not API_KEYS:
        raise ValueError("No API keys available")

    current_key = API_KEYS[current_key_index]
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=current_key,
    )


def _switch_to_next_key():
    """Переключается на следующий API ключ"""
    global current_key_index
    current_key_index = (current_key_index + 1) % len(API_KEYS)
    print(f"Switched to API key index: {current_key_index + 1}")


MODEL = os.getenv("MODEL")


def _extract_json_from_text(text: str) -> tuple[str, str | None]:
    """
    Извлекает JSON из текста и возвращает кортеж (очищенный_текст, json_строка)
    """
    json_data = None
    cleaned_text = text

    # Ищем любой JSON в тексте (самый простой способ)
    try:
        # Пытаемся найти JSON объект
        start_idx = text.find('{')
        end_idx = text.rfind('}')

        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            end_position = end_idx + 1
            json_str = text[start_idx:end_position]
            # Проверяем, что это валидный JSON
            json.loads(json_str)  # Если не валиден, выбросит исключение
            json_data = json_str
            # Удаляем JSON из текста
            cleaned_text = text[:start_idx] + text[end_position:]
            # Очищаем текст
            cleaned_text = cleaned_text.strip()
    except Exception as e:
        print(f"Ошибка: {e}")

    return cleaned_text, json_data


def send_to_llm(user_id: str, user_message: str) -> Tuple[str, Optional[Dict]]:
    add_message(user_id, "user", user_message)

    messages = [m.model_dump() for m in get_conversation(user_id)]

    max_retries = len(API_KEYS)

    for attempt in range(max_retries):
        try:
            client = _get_client()
            completion = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                extra_body={
                    "reasoning": {"exclude": True},
                },
            )

            response = completion.choices[0].message.content
            if not response:
                return "", None

            if response.startswith('\n'):
                response = response.lstrip('\n')

            response = response.lstrip()

            # Извлекаем JSON и оставляем только текстовую часть для ответа пользователю
            cleaned_response, json_data_str = _extract_json_from_text(response)

            # Переменная для извлеченных JSON данных
            extracted_data = None

            # Если нашли JSON, пытаемся его распарсить
            if json_data_str:
                try:
                    extracted_data = json.loads(json_data_str)
                    print(f"Найден и распаршен JSON: {extracted_data}")
                except json.JSONDecodeError as e:
                    print(f"Ошибка парсинга JSON: {e}")
                    extracted_data = None

            # На фронт отправляем только очищенный текст
            final_response = cleaned_response if cleaned_response else response

            add_message(user_id, "assistant", final_response)

            # Возвращаем И текст, И JSON данные
            return final_response, extracted_data

        except Exception as e:
            # Универсальная обработка всех исключений
            error_str = str(e).lower()

            # Проверяем все возможные признаки rate limit
            is_rate_limit = (
                hasattr(e, 'status')
                and e.status == 429  # Прямой статус 429
                or '429' in error_str  # Код 429 в тексте ошибки
                or 'rate limit' in error_str  # Упоминание rate limit
                or 'ratelimit' in error_str  # Альтернативное написание
                or 'too many requests' in error_str  # Другая формулировка
                or 'exceeded' in error_str  # Общее указание на превышение
            )

            if is_rate_limit:
                print(f"Rate limit detected on attempt {attempt + 1}. Error: {e}")
                print("Switching API key...")

                if attempt < max_retries - 1:
                    _switch_to_next_key()
                    sleep_time = 2 * (attempt + 1)
                    print(f"Waiting {sleep_time} seconds before retry...")
                    time.sleep(sleep_time)
                    continue  # Продолжаем с следующей попытки
                else:
                    raise Exception(
                        f"All {max_retries} API keys exhausted "
                        f"with rate limits. Last error: {e}"
                    )
            else:
                # Для других исключений просто пробрасываем
                print(f"Non-rate-limit error: {e}")
                raise e

    raise Exception(f"Failed after {max_retries} attempts")


async def send_to_llm_async(user_id: str, user_message: str) -> Tuple[str, Optional[Dict]]:
    """
    Async-friendly wrapper that runs the blocking OpenAI client in a thread
    to avoid blocking the event loop while waiting for LLM responses.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, send_to_llm, user_id, user_message)


def parse_llm_goal_response(llm_response: str):
    """Парсит чистый JSON из ответа LLM"""
    try:
        # Сначала пытаемся извлечь JSON из ответа
        _, json_data = _extract_json_from_text(llm_response)

        # Если нашли JSON, используем его, иначе пытаемся распарсить весь ответ
        data_str = json_data if json_data else llm_response

        data = json.loads(data_str)

        term = float(data.get("term", 60))
        sum_val = float(data.get("sum", 1000000))
        capital = float(data.get("capital", 0))
        reason = str(data.get("reason", "инвестирование"))

        goal_data = LLMGoalData(
            term=term,
            sum=sum_val,
            reason=reason,
            capital=capital,
        )

        return goal_data

    except json.JSONDecodeError:
        return None
    except Exception:
        return None


def _get_chat_key(user_id: str) -> str:
    """Генерирует ключ для хранения истории чата"""
    return f"user:{user_id}:chat_history"


def add_message(user_id: str, role: str, content: str):
    """Добавляет сообщение в историю чата пользователя"""
    message = Message(role=role, content=content)
    chat_key = _get_chat_key(user_id)

    cache.append_to_list(chat_key, message.model_dump())


def get_conversation(user_id: str):
    """Получает всю историю чата пользователя"""
    chat_key = _get_chat_key(user_id)
    messages_data = cache.get_list(chat_key)

    messages = []
    for msg_data in messages_data:
        messages.append(Message(**msg_data))

    return messages


def clear_conversation(user_id: str):
    """Очищает историю чата пользователя"""
    chat_key = _get_chat_key(user_id)
    if cache.enabled:
        cache.client.delete(chat_key)
    else:
        if chat_key in cache._memory:
            del cache._memory[chat_key]
