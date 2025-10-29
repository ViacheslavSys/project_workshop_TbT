from sqlalchemy.orm import Session

from app.core.redis_cache import cache
from app.repositories.inflation_repository import InflationRepository
from app.schemas.portfolio import PortfolioCalculationResponse


class PortfolioService:
    def __init__(self, db_session: Session):
        self.db_session = db_session
        self.inflation_repo = InflationRepository()

    def calculate_future_value_with_inflation(
        self, goal_sum: float, term_months: int
    ) -> float:
        """
        Расчет будущей стоимости с учетом инфляции
        """
        latest_inflation = self.inflation_repo.get_latest(self.db_session)

        if not latest_inflation:
            annual_inflation_rate = 0.08
        else:
            annual_inflation_rate = latest_inflation.value / 100

        total_years = term_months / 12

        # Расчет будущей стоимости с учетом инфляции
        future_value = goal_sum * ((1 + annual_inflation_rate) ** total_years)

        return future_value, annual_inflation_rate

    def calculate_portfolio(self, user_id: str) -> PortfolioCalculationResponse:
        """
        Основной метод расчета целевой стоимости
        """
        # Получаем данные цели из кеша
        goal_data = cache.get_json(f"user:{user_id}:llm_goal")
        if not goal_data:
            raise ValueError(
                "Данные цели не найдены. Сначала определите цель через диалог."
            )

        term_months = goal_data["term"]
        target_amount = goal_data["sum"]
        initial_capital = goal_data["capital"]

        # Расчет с учетом инфляции
        future_value, inflation_rate = self.calculate_future_value_with_inflation(
            goal_sum=target_amount, term_months=term_months
        )
        return PortfolioCalculationResponse(
            target_amount=target_amount,
            initial_capital=initial_capital,
            investment_term_months=term_months,
            annual_inflation_rate=inflation_rate,
            future_value_with_inflation=future_value,
        )
