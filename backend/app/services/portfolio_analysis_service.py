import json
import os

import dotenv
from openai import OpenAI

from app.core.redis_cache import cache

dotenv.load_dotenv()


class PortfolioAnalysisService:
    def __init__(self):
        self.llm_client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=f"{os.environ.get('OPENROUTER_API_KEY')}",
        )
        self.model = os.getenv("MODEL_ANALYSIS")

    def analyze_portfolio(self, user_id: str) -> str:
        """Анализирует портфель пользователя через LLM"""

        # Получаем портфель из кеша
        portfolio_key = f"user:{user_id}:portfolio"
        portfolio_data = cache.get_json(portfolio_key)

        if not portfolio_data:
            raise ValueError(f"Портфель не найден для пользователя {user_id}")

        # Отправляем JSON напрямую в LLM
        completion = self.llm_client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(portfolio_data, ensure_ascii=False),
                }
            ],
        )

        response = completion.choices[0].message.content
        print(f"response {response}")
        return response
