import os
import dotenv
import json
from openai import OpenAI
from app.repositories.chat_memory import get_conversation, add_message

dotenv.load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)


MODEL = os.getenv("MODEL")


def send_to_llm(user_id: str, user_message: str) -> str:
    add_message(user_id, "user", user_message)
   
    messages = [m.model_dump() for m in get_conversation(user_id)]
    
    completion = client.chat.completions.create(
        model=MODEL,
        messages=messages
    )

    response = completion.choices[0].message.content
  
    add_message(user_id, "assistant", response)

    return response
