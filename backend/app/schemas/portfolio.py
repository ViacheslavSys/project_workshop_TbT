from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class PortfolioAssetIn(BaseModel):
    asset_id: int
    weight: float


class PortfolioCreate(BaseModel):
    investment_amount: float
    risk_profile: str
    time_horizon: int
    assets: Optional[List[PortfolioAssetIn]] = []


class PortfolioOut(BaseModel):
    id: int
    investment_amount: float
    risk_profile: str
    time_horizon: int
    expected_return: Optional[float]
    portfolio_risk: Optional[float]
    sharpe_ratio: Optional[float]
    current_cycle_phase: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True
