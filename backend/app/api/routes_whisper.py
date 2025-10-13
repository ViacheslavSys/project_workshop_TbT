import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.whisper_processor import whisper_processor
from app.schemas.whisper import TranscriptionResponse


router = APIRouter(prefix="/dialog", tags=["dialog"])


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(..., description="Аудио файл для транскрипции"),
    model_type: str = Form("base", description="Тип модели Whisper")
):
    """
    Транскрибирует аудио файл с помощью Whisper
    """
    allowed_extensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.mp4']
    file_extension = os.path.splitext(audio_file.filename)[1].lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Неподдерживаемый формат файла. Разрешены: {', '.join(allowed_extensions)}"
        )

    try:
        if model_type != whisper_processor.model_type:
            whisper_processor.model_type = model_type
            whisper_processor.model = None

        result = await whisper_processor.transcribe_audio_file(audio_file)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def whisper_health():
    """Проверка здоровья сервиса"""
    return {
        "status": "ready",
        "model_loaded": whisper_processor.model is not None,
        "current_model": whisper_processor.model_type,
        "device": whisper_processor.device
    }
