from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String

from app.core.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    prediction_date = Column(Date, nullable=False)
    target_date = Column(Date, nullable=False)
    predicted_return = Column(Numeric(8, 4))
    predicted_volatility = Column(Numeric(8, 4))
    cycle_factor = Column(Numeric(4, 2))
    confidence = Column(Numeric(4, 2))
    model_version = Column(String(20))
