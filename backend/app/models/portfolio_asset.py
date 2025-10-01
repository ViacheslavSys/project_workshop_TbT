from sqlalchemy import Column, ForeignKey, Integer, Numeric

from app.core.database import Base


class PortfolioAsset(Base):
    __tablename__ = "portfolio_assets"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"))
    asset_id = Column(Integer, ForeignKey("assets.id"))
    weight = Column(Numeric(6, 4), nullable=False)
    expected_return = Column(Numeric(8, 4))
    cycle_factor = Column(Numeric(4, 2))
