from sqlalchemy import TIMESTAMP, Boolean, Column, Integer, String, text

from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    sector = Column(String(50), nullable=False)
    sector_type = Column(String(20), nullable=False)  # cyclical/defensive
    is_active = Column(Boolean, server_default=text("true"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
