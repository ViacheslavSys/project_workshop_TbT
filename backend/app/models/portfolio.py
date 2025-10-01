from sqlalchemy import TIMESTAMP, Column, ForeignKey, Integer, Numeric, String, text

from app.core.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    investment_amount = Column(Numeric(15, 2), nullable=False)
    risk_profile = Column(String(20), nullable=False)
    time_horizon = Column(Integer, nullable=False)
    expected_return = Column(Numeric(8, 4))
    portfolio_risk = Column(Numeric(8, 4))
    sharpe_ratio = Column(Numeric(8, 4))
    current_cycle_phase = Column(String(20))
