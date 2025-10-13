import os
import tempfile
from typing import Dict, Any
from fastapi import UploadFile, HTTPException
import whisper
import torch


class WhisperProcessor:
    """Упрощенный класс для обработки аудио файлов с помощью Whisper"""

    def __init__(self, model_type: str = "base"):
        self.model_type = model_type
        self.model = None
        self.device = self._get_best_device()

    def _get_best_device(self) -> str:
        """Определяет лучшее доступное устройство"""
        if torch.cuda.is_available():
            try:
                test_tensor = torch.tensor([1.0]).cuda()
                del test_tensor
                torch.cuda.empty_cache()
                return "cuda"
            except RuntimeError:
                return "cpu"
        return "cpu"

    def load_model(self):
        """Загружает модель Whisper"""
        if self.model is None:
            self.model = whisper.load_model(self.model_type, device=self.device)

    async def transcribe_audio_file(self, audio_file: UploadFile) -> Dict[str, Any]:
        """
        Транскрибирует аудио файл

        Args:
            audio_file: Загруженный аудио файл из FastAPI

        Returns:
            Dict с результатом транскрипции
        """
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp_file:
            try:
                content = await audio_file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name

                self.load_model()

                result = self.model.transcribe(
                    tmp_file_path,
                    verbose=False,
                    fp16=(self.device == "cuda"),
                    language="ru"
                )

                return {
                    "text": result["text"].strip(),
                    "language": result.get("language", "ru"),
                    "model_used": self.model_type,
                    "device_used": self.device,
                    "filename": audio_file.filename
                }

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ошибка транскрипции: {str(e)}")
            finally:
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)


whisper_processor = WhisperProcessor()
