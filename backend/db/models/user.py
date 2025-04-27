from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from ..base_class import Base  # или Base напрямую из SQLAlchemy

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    username = Column(String, unique=True, index=True)
    profile_picture = Column(String)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
