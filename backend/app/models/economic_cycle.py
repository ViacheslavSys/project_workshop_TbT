from sqlalchemy import Column, Date, Integer, Numeric, String

from app.core.database import Base


class EconomicCycle(Base):
    __tablename__ = "economic_cycles"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    cycle_phase = Column(String(20), nullable=False)
    probability = Column(Numeric(4, 2), nullable=False)
    confidence = Column(Numeric(4, 2), nullable=False)
    model_version = Column(String(20))
