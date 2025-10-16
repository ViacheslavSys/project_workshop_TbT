import os
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.chat import ChatResponse
from app.services.llm_service import send_to_llm
from app.services.whisper_processor import whisper_processor

router = APIRouter(prefix="/dialog", tags=["dialog"])


@router.post("/chat", response_model=ChatResponse)
async def dialog_chat(
    user_id: str = Form(..., description="ID пользователя"),
    message: Optional[str] = Form(None, description="Текстовое сообщение пользователя"),
    audio_file: Optional[UploadFile] = File(
        None, description="Аудио сообщение пользователя"
    ),
):
    """
    Универсальный endpoint для диалога:
    - если передан message → сразу LLM
    - если передан audio_file → Whisper → LLM
    """
    try:
        if audio_file:
            allowed_extensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.mp4']
            file_extension = os.path.splitext(audio_file.filename)[1].lower()
            if file_extension not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Неподдерживаемый формат файла. "
                    f"Разрешены: {', '.join(allowed_extensions)}",
                )

            result = await whisper_processor.transcribe_audio_file(audio_file)
            user_message = result["text"].strip()
            print(f"🎤 [{user_id}] сказал голосом: {user_message}")

        elif message:
            user_message = message.strip()
            print(f"💬 [{user_id}] написал: {user_message}")

        else:
            raise HTTPException(
                status_code=400, detail="Нужно передать либо текст, либо аудио"
            )

        llm_response = send_to_llm(user_id, user_message)
        print(f"🧠 Ответ LLM: {llm_response[:200]}...")

        return ChatResponse(response=llm_response)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка обработки запроса: {str(e)}"
        )
