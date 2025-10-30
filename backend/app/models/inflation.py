import datetime

from sqlalchemy import Column, Date, Float, Integer

from app.core.database import Base


class Inflation(Base):
    __tablename__ = "inflation"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, default=datetime.date.today)
    value = Column(Float, nullable=False)
