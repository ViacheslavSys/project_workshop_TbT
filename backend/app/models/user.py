from sqlalchemy import TIMESTAMP, Boolean, Column, Integer, String, text
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    
    is_active = Column(Boolean, server_default=text("true"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    portfolios = relationship("Portfolio", back_populates="user")
