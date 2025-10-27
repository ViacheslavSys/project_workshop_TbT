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
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

MODEL = os.getenv("MODEL")


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


def send_to_llm(user_id: str, user_message: str) -> str:

    add_message(user_id, "user", user_message)

    messages = [m.model_dump() for m in get_conversation(user_id)]

    completion = client.chat.completions.create(model=MODEL, messages=messages)

    response = completion.choices[0].message.content

    add_message(user_id, "assistant", response)

    return response


def parse_llm_goal_response(llm_response: str):
    """Парсит чистый JSON из ответа LLM"""
    try:
        data = json.loads(llm_response)

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
