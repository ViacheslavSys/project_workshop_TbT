import json
import os
import time
from datetime import datetime

import dotenv
from openai import OpenAI
from sqlalchemy.orm import Session

from app.services.portfolio_service import PortfolioService

dotenv.load_dotenv()


class PortfolioAnalysisService:
    def __init__(self):
        self.api_keys = self._get_api_keys()
        self.current_key_index = 0
        self.model = os.getenv("MODEL_ANALYSIS")

    def _get_api_keys(self):
        """Получает все API ключи из .env"""
        keys = []
        i = 1
        while True:
            key_name = f"OPENROUTER_API_KEY_{i}" if i > 1 else "OPENROUTER_API_KEY"
            key_value = os.environ.get(key_name)
            if key_value:
                keys.append(key_value)
                i += 1
            else:
                break
        return keys

    def _get_client(self):
        """Создает клиент с текущим API ключом"""
        if not self.api_keys:
            raise ValueError("No API keys available")

        current_key = self.api_keys[self.current_key_index]
        return OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=current_key,
        )

    def _switch_to_next_key(self):
        """Переключается на следующий API ключ"""
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        print(f"Switched to API key index: {self.current_key_index + 1}")

    def analyze_portfolio(
        self, user_id: int, portfolio_id: int, db_session: Session
    ) -> str:
        """Анализирует портфель пользователя из БД через LLM и сохраняет объяснение"""

        print(f"Using model: {self.model}")
        if not db_session:
            raise ValueError("Database session is required for portfolio analysis")

        # Получаем портфель из БД через PortfolioService
        portfolio_service = PortfolioService(db_session)

        # Получаем портфель с проверкой принадлежности пользователю
        portfolio = portfolio_service.portfolio_repo.get_portfolio_by_id(
            portfolio_id, user_id
        )

        if not portfolio:
            raise ValueError(
                f"Портфель {portfolio_id} не найден для пользователя {user_id}"
            )

        portfolio_response = portfolio_service.convert_db_to_response(portfolio)

        from fastapi.encoders import jsonable_encoder

        portfolio_dict = jsonable_encoder(portfolio_response)

        max_retries = len(self.api_keys)

        for attempt in range(max_retries):
            try:
                client = self._get_client()

                completion = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "user",
                            "content": json.dumps(portfolio_dict, ensure_ascii=False),
                        }
                    ],
                )

                response = completion.choices[0].message.content
                print(f"Response: {response}")

                # Сохраняем объяснение в базу данных
                self._save_analysis_explanation(db_session, portfolio_id, response)

                return response

            except Exception as e:
                # Универсальная обработка всех исключений
                error_str = str(e).lower()

                # Проверяем все возможные признаки rate limit
                is_rate_limit = (
                    hasattr(e, 'status')
                    and e.status == 429  # Прямой статус 429
                    or '429' in error_str  # Код 429 в тексте ошибки
                    or 'rate limit' in error_str  # Упоминание rate limit
                    or 'ratelimit' in error_str  # Альтернативное написание
                    or 'too many requests' in error_str  # Другая формулировка
                    or 'exceeded' in error_str  # Общее указание на превышение
                )

                if is_rate_limit:
                    print(f"Rate limit detected on attempt {attempt + 1}. Error: {e}")
                    print("Switching API key...")

                    if attempt < max_retries - 1:
                        self._switch_to_next_key()
                        sleep_time = 2 * (attempt + 1)
                        print(f"Waiting {sleep_time} seconds before retry...")
                        time.sleep(sleep_time)
                        continue  # Продолжаем с следующей попытки
                    else:
                        raise Exception(
                            f"All {max_retries} API keys exhausted with rate limits. "
                            f"Last error: {e}"
                        )
                else:
                    # Для других исключений просто пробрасываем
                    print(f"Non-rate-limit error: {e}")
                    raise e

        raise Exception(f"Failed after {max_retries} attempts")

    def _save_analysis_explanation(
        self, db_session: Session, portfolio_id: int, analysis_text: str
    ):
        """Сохраняет или обновляет анализ портфеля"""
        try:
            from app.models.portfolio import PortfolioCalculationExplanation

            # Ищем существующий анализ
            existing_analysis = (
                db_session.query(PortfolioCalculationExplanation)
                .filter(PortfolioCalculationExplanation.portfolio_id == portfolio_id)
                .first()
            )

            if existing_analysis:
                # Обновляем существующий
                existing_analysis.explanation_text = analysis_text
                existing_analysis.updated_at = datetime.now()
                print(f"Анализ портфеля {portfolio_id} обновлен")
            else:
                # Создаем новый
                explanation = PortfolioCalculationExplanation(
                    portfolio_id=portfolio_id, explanation_text=analysis_text
                )
                db_session.add(explanation)
                print(f"Анализ портфеля {portfolio_id} создан")

            db_session.commit()

        except Exception as e:
            db_session.rollback()
            print(f"Ошибка при сохранении анализа портфеля: {e}")
