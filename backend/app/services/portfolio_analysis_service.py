import json
import os

import dotenv
from openai import OpenAI
from sqlalchemy.orm import Session

from app.services.portfolio_service import PortfolioService

dotenv.load_dotenv()


class PortfolioAnalysisService:
    def __init__(self):
        self.llm_client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=f"{os.environ.get('OPENROUTER_API_KEY')}",
        )
        self.model = os.getenv("MODEL_ANALYSIS")

    def analyze_portfolio(
        self, user_id: int, portfolio_id: int, db_session: Session
    ) -> str:
        """Анализирует портфель пользователя из БД через LLM"""

        print(self.model)
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
        portfolio_dict = portfolio_response.dict()
        # Отправляем JSON напрямую в LLM

        completion = self.llm_client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(portfolio_dict, ensure_ascii=False),
                }
            ],
        )

        response = completion.choices[0].message.content
        print(f"response {response}")
        return response
