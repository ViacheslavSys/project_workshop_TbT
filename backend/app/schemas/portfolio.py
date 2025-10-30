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


class PortfolioCreate(BaseModel):
    user_id: str
    portfolio_name: str


class PortfolioCalculationResponse(BaseModel):
    target_amount: float
    initial_capital: float
    investment_term_months: int
    annual_inflation_rate: float
    future_value_with_inflation: float
    recommendation: Optional[PortfolioRecommendation]
