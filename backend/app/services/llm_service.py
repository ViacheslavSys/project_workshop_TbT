import os

import dotenv
from openai import OpenAI

from app.repositories.chat_memory import add_message, get_conversation

dotenv.load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="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",
)


MODEL = "tngtech/deepseek-r1t2-chimera:free@preset/deep-seek-r1-t2"


def send_to_llm(user_id: str, user_message: str) -> str:
    add_message(user_id, "user", user_message)

    messages = [m.model_dump() for m in get_conversation(user_id)]

    completion = client.chat.completions.create(model=MODEL, messages=messages)

    response = completion.choices[0].message.content

    add_message(user_id, "assistant", response)

    return response
