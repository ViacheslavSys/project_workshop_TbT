from pydantic import BaseModel


class PortfolioCalculationRequest(BaseModel):
    user_id: str


class PortfolioCalculationResponse(BaseModel):
    target_amount: float
    initial_capital: float
    investment_term_months: int
    annual_inflation_rate: float
    future_value_with_inflation: float
