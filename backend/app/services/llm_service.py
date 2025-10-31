import json
import os

import dotenv
from openai import OpenAI

from app.core.redis_cache import cache
from app.schemas.chat import Message
from app.schemas.risk_profile import LLMGoalData

dotenv.load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=f"{os.environ.get('OPENROUTER_API_KEY')}",
)

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
            json_str = text[start_idx: end_idx + 1]
            # Проверяем, что это валидный JSON
            json.loads(json_str)  # Если не валиден, выбросит исключение
            json_data = json_str
            # Удаляем JSON из текста
            cleaned_text = text[:start_idx] + text[end_idx + 1:]
            # Очищаем текст
            cleaned_text = cleaned_text.strip()
    except Exception as e:
        print(f"Ошибка: {e}")

    return cleaned_text, json_data


def send_to_llm(user_id: str, user_message: str) -> str:
    add_message(user_id, "user", user_message)

    messages = [m.model_dump() for m in get_conversation(user_id)]

    completion = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        extra_body={
            "reasoning": {"exclude": True},
        },
    )

    response = completion.choices[0].message.content

    if not response:
        return ""

    if response.startswith('\n'):
        response = response.lstrip('\n')

    response = response.lstrip()

    # Извлекаем JSON и оставляем только текстовую часть для ответа пользователю
    cleaned_response, json_data = _extract_json_from_text(response)

    # Если нашли JSON, сохраняем его отдельно (если нужно)
    if json_data:
        print(f"Найден JSON в ответе: {json_data}")  # Для отладки
        # Здесь можно сохранить JSON в кэш или базу, если нужно

    # На фронт отправляем только очищенный текст
    final_response = cleaned_response if cleaned_response else response

    add_message(user_id, "assistant", final_response)

    return final_response


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
