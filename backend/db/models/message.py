from sqlalchemy import Column, Integer, ForeignKey, Text, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base_class import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    subgroup_id = Column(Integer, ForeignKey("subgroups.id"), nullable=True)  # может быть null, если сообщение не в подгруппе
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text)
    image_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    chat = relationship("Chat")
    subgroup = relationship("Subgroup")
    sender = relationship("User")
