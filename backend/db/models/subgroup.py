from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ..base_class import Base

class Subgroup(Base):
    __tablename__ = "subgroups"

    id = Column(Integer, primary_key=True)
    parent_chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    parent_chat = relationship("Chat")


class SubgroupMember(Base):
    __tablename__ = "subgroup_members"

    id = Column(Integer, primary_key=True)
    subgroup_id = Column(Integer, ForeignKey("subgroups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    subgroup = relationship("Subgroup")
    user = relationship("User")
