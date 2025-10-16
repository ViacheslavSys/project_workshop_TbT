from collections import defaultdict
from app.schemas.chat import Message

user_conversations = defaultdict(list)


def get_conversation(user_id: str):
    return user_conversations[user_id]


def add_message(user_id: str, role: str, content: str):
    user_conversations[user_id].append(Message(role=role, content=content))
