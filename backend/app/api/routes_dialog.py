import os
from typing import Optional

from app.core.redis_cache import cache
from app.schemas.chat import ChatResponse
from app.services.llm_service import parse_llm_goal_response, send_to_llm
from app.services.whisper_processor import whisper_processor
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

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
    print("Начал")
    try:
        if audio_file:
            allowed_extensions = [".mp3", ".wav", ".m4a", ".flac", ".ogg", ".mp4"]
            file_extension = os.path.splitext(audio_file.filename)[1].lower()
            if file_extension not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Неподдерживаемый формат файла. "
                    f"Разрешены: {', '.join(allowed_extensions)}",
                )

            result = await whisper_processor.transcribe_audio_file(audio_file)
            user_message = result["text"].strip()

        elif message:
            user_message = message.strip()

        else:
            raise HTTPException(
                status_code=400, detail="Нужно передать либо текст, либо аудио"
            )

        print("Отправка в LLM")
        llm_response = send_to_llm(user_id, user_message)
        print(f"ответ от LLM {llm_response}")
        goal_data = parse_llm_goal_response(llm_response)
        print("Прасинг")
        if goal_data:
            if goal_data.term is not None:
                cache.set_json(f"user:{user_id}:llm_goal", goal_data.dict())

                friendly_response = (
                    f"Отлично! Я понял вашу цель: {goal_data.reason}. "
                    f"Срок: {goal_data.term} месяцев, "
                    f"Сумма: {goal_data.sum:,} ₽, "
                    f"Капитал: {goal_data.capital:,} ₽. "
                    f"Теперь перейдем к определению вашего риск-профиля."
                )
        else:
            friendly_response = llm_response

        return ChatResponse(response=friendly_response)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка обработки запроса: {str(e)}"
        )
