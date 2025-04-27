from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base_class import Base

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    websocket_id = Column(String, nullable=True)
    is_online = Column(Boolean, default=False)
    last_active = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
