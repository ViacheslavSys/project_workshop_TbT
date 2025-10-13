import os
import tempfile
from typing import Dict, Any
from fastapi import UploadFile, HTTPException
from app.services.whisper_processor import WhisperProcessor


class WhisperAPIService:
    def __init__(self):
        self.processor = None

    async def transcribe_audio(self, audio_file: UploadFile, model_type: str = "base") -> Dict[str, Any]:
        """
        Транскрибирует аудио файл используя ваш WhisperProcessor
        """
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp_file:
            try:
                # Сохраняем загруженный файл
                content = await audio_file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name

                # Используем ваш WhisperProcessor
                self.processor = WhisperProcessor(
                    model_type=model_type,
                    language="ru",
                    file_path=tmp_file_path,
                    verbose=True
                )

                # Выполняем транскрипцию
                success = self.processor.transcribe_audio()

                if not success:
                    raise HTTPException(status_code=500, detail="Транскрипция не удалась")

                # Получаем результат
                result = self.processor.get_full_result()

                return {
                    "text": result.get("text", ""),
                    "language": result.get("language", "ru"),
                    "model_used": model_type,
                    "device_used": result.get("device_used", "cpu"),
                    "filename": audio_file.filename,
                    "success": True
                }

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ошибка транскрипции: {str(e)}")
            finally:
                # Удаляем временный файл
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)


# Глобальный экземпляр сервиса
whisper_service = WhisperAPIService()
