from pydantic import BaseModel


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    model_used: str
    device_used: str
    filename: str
