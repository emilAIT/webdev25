from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from .base import Base

class User(Base):
    """Модель пользователя."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    avatar = Column(String, nullable=True)

class Friend(Base):
    """Модель дружбы между пользователями."""
    __tablename__ = "friends"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    friend_id = Column(Integer, ForeignKey("users.id"))

class Chat(Base):
    """Модель чата."""
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    is_group = Column(Boolean, default=False)
    owner_id = Column(Integer, ForeignKey("users.id"))
    avatar = Column(String, nullable=True)
    created_at = Column(DateTime)
    description = Column(String, nullable=True)
    members = relationship("ChatMember", back_populates="chat")
    messages = relationship("Message", back_populates="chat")

class ChatMember(Base):
    """Модель участника чата."""
    __tablename__ = "chat_members"
    id = Column(Integer, primary_key=True)
    chat_id = Column(Integer, ForeignKey("chats.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member")  # "owner", "admin", "member"
    joined_at = Column(DateTime)
    chat = relationship("Chat", back_populates="members")
    user = relationship("User")

class Message(Base):
    """Модель сообщения."""
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    text = Column(Text)
    timestamp = Column(DateTime)
    status = Column(String)  # "sent", "read"
    edited = Column(Boolean, default=False)
    chat = relationship("Chat", back_populates="messages")
