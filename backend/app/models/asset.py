from sqlalchemy import Column, Float, Integer, String

from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    ticker = Column(String, nullable=False)
    type = Column(String, nullable=False)
    price_old = Column(Float, nullable=True)
    price_now = Column(Float, nullable=True)
    yield_value = Column(Float, nullable=True)
    volatility = Column(Float, nullable=True)
