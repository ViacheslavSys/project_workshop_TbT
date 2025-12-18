import os
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.redis_cache import cache
from app.schemas.chat import ChatResponse
from app.schemas.risk_profile import LLMGoalData
from app.services.llm_service import send_to_llm_async
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
    print("Начал")
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

        elif message:
            user_message = message.strip()

        else:
            raise HTTPException(
                status_code=400, detail="Нужно передать либо текст, либо аудио"
            )

        print("Отправка в LLM")
        llm_response_text, extracted_json = await send_to_llm_async(user_id, user_message)
        print(f"ответ от LLM {llm_response_text}")
        print(f"JSON данные {extracted_json}")

        # По умолчанию все поля False
        term_bool = False
        sum_bool = False
        reason_bool = False
        capital_bool = False
        friendly_response = llm_response_text

        # Проверяем, есть ли JSON данные
        if extracted_json:
            # Проверяем каждое поле: если есть значение и оно не "False", то True
            term_val = extracted_json.get("term")
            sum_val = extracted_json.get("sum")
            reason_val = extracted_json.get("reason")
            capital_val = extracted_json.get("capital")

            term_bool = term_val is not None and str(term_val).lower() != "false"
            sum_bool = sum_val is not None and str(sum_val).lower() != "false"
            reason_bool = reason_val is not None and str(reason_val).lower() != "false"
            capital_bool = (
                capital_val is not None and str(capital_val).lower() != "false"
            )

            # Если все поля True, то парсим goal_data
            if all([term_bool, sum_bool, reason_bool, capital_bool]):
                try:
                    term = float(term_val)
                    sum_val_float = float(sum_val)
                    capital = float(capital_val)
                    reason = str(reason_val)

                    goal_data = LLMGoalData(
                        term=term,
                        sum=sum_val_float,
                        reason=reason,
                        capital=capital,
                    )

                    cache.set_json(f"user:{user_id}:llm_goal", goal_data.dict())

                    friendly_response = (
                        f"Отлично! Я понял вашу цель: {goal_data.reason}. "
                        f"Срок: {goal_data.term} месяцев, "
                        f"Сумма: {goal_data.sum:,} ₽, "
                        f"Капитал: {goal_data.capital:,} ₽. "
                        f"Теперь перейдем к определению вашего риск-профиля."
                    )
                except Exception as e:
                    print(f"Ошибка при создании goal_data: {e}")

        return ChatResponse(
            response=friendly_response,
            term=term_bool,
            sum=sum_bool,
            reason=reason_bool,
            capital=capital_bool,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка обработки запроса: {str(e)}"
        )
