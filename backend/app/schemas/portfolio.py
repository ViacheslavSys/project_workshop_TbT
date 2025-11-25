from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class PortfolioCalculationRequest(BaseModel):
    user_id: str


class MonthlyPaymentDetail(BaseModel):
    monthly_payment: float
    future_capital: float
    total_months: int
    monthly_rate: float
    annuity_factor: float


class AssetAllocation(BaseModel):
    name: str
    type: str
    ticker: str
    quantity: int
    price: float
    weight: float
    amount: float
    expected_return: Optional[float] = None


class PortfolioComposition(BaseModel):
    asset_type: str
    target_weight: float
    actual_weight: float
    amount: float
    assets: List[AssetAllocation]


class PlanStep(BaseModel):
    """Шаг пошагового плана"""

    step_number: int
    title: str
    description: str
    actions: List[str]


class StepByStepPlan(BaseModel):
    """Пошаговый план инвестирования"""

    steps: List[PlanStep]
    generated_at: str
    total_steps: int


class PortfolioRecommendation(BaseModel):
    target_amount: float
    initial_capital: float
    investment_term_months: int
    annual_inflation_rate: float
    future_value_with_inflation: float
    risk_profile: str
    time_horizon: str
    smart_goal: str
    total_investment: float
    expected_portfolio_return: float
    composition: List[PortfolioComposition]
    monthly_payment_detail: MonthlyPaymentDetail
    step_by_step_plan: Optional[StepByStepPlan] = None


class PortfolioCreate(BaseModel):
    user_id: str
    portfolio_name: str


class PortfolioCalculationResponse(BaseModel):
    target_amount: float
    initial_capital: float
    investment_term_months: int
    annual_inflation_rate: float
    future_value_with_inflation: float
    updated_at: Optional[datetime] = None
    recommendation: Optional[PortfolioRecommendation]
    analysis: Optional[str] = None


class PortfolioAnalysisRequest(BaseModel):
    portfolio_id: str


class PortfolioAnalysisResponse(BaseModel):
    analysis: str


class PortfolioSummary(BaseModel):
    """Схема для краткой информации о портфеле"""

    id: int
    portfolio_name: str
    target_amount: float
    initial_capital: float
    risk_profile: str
    created_at: datetime  # ← Измените на datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PortfolioSaveResponse(BaseModel):
    """Ответ при сохранении портфеля"""

    message: str
    portfolio_id: int
    portfolio_name: str


class PortfolioListResponse(BaseModel):
    """Ответ со списком портфелей"""

    portfolios: List[PortfolioSummary]


class PortfolioSaveRequest(BaseModel):
    user_id: str  # session_token для Redis
    portfolio_name: str
