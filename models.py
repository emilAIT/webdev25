# models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)  # Храним в открытом виде (для учебного проекта)
    avatar = Column(String, nullable=True)  # Ссылка на аватар

    # Явно указываем, что для связи с сообщениями используется именно author_id
    messages = relationship(
        "Message",
        back_populates="author",
        foreign_keys="[Message.author_id]"
    )

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    background = Column(String, nullable=True)
    type = Column(String, nullable=True)  # Добавляем поле type

class GroupUser(Base):
    __tablename__ = "group_users"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    edited = Column(Integer, default=0)
    
    # Владелец сообщения (автор)
    author_id = Column(Integer, ForeignKey("users.id"))
    author = relationship(
        "User",
        back_populates="messages",
        foreign_keys=[author_id]
    )

    # Поле для группового чата
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    
    # Для личных сообщений: id получателя
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    recipient = relationship("User", foreign_keys=[recipient_id])
    