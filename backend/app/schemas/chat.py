from pydantic import BaseModel
from typing import List, Literal


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    response: str


class Conversation(BaseModel):
    messages: List[Message]
