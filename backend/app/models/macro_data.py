from sqlalchemy import Column, Date, Integer, Numeric, String

from app.core.database import Base


class MacroData(Base):
    __tablename__ = "macro_data"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    indicator = Column(String(50), nullable=False)
    value = Column(Numeric(10, 4), nullable=False)
    source = Column(String(50), nullable=False)
