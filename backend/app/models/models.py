from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from ..database.database import Base

# Association table for group members (many-to-many relationship)
group_members = Table(
    "group_members",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("groups.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(
        String, unique=True, index=True, nullable=False
    )  # Added unique constraint for username
    password = Column(String, nullable=False)  # Stored as a hash
    avatar = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sent_messages = relationship(
        "Message", foreign_keys="Message.sender_id", back_populates="sender"
    )
    groups = relationship("Group", secondary=group_members, back_populates="members")


class DirectChat(Base):
    __tablename__ = "direct_chats"
    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"), index=True)
    user2_id = Column(Integer, ForeignKey("users.id"), index=True)
    last_message = Column(Text, nullable=True)
    last_time = Column(DateTime, nullable=True)
    ai_config_prompt = Column(
        Text, nullable=True
    )  # New field for AI configuration prompt

    # Relationships
    messages = relationship(
        "Message", back_populates="direct_chat", cascade="all, delete-orphan"
    )


class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    avatar = Column(String)
    ai_config_prompt = Column(
        Text, nullable=True
    )  # New field for AI configuration prompt

    # Relationships
    members = relationship("User", secondary=group_members, back_populates="groups")
    messages = relationship(
        "Message", back_populates="group", cascade="all, delete-orphan"
    )
    read_statuses = relationship("MessageReadStatus", back_populates="group")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    direct_chat_id = Column(Integer, ForeignKey("direct_chats.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)
    edited = Column(Boolean, default=False)  # New field to track if message was edited
    edited_at = Column(
        DateTime, nullable=True
    )  # New field to track when message was edited

    # --- ДОБАВЛЕНО: Поле и связь для ответа на сообщение ---
    reply_to_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    # Связь "один ко многим" для ответов (одно сообщение может иметь много ответов)
    replies = relationship("Message", backref="reply_to_message", remote_side=[id])
    # --- КОНЕЦ ДОБАВЛЕНИЯ ---

    # --- ДОБАВЛЕНО: Поля для пересылаемых сообщений ---
    forwarded = Column(Boolean, default=False)  # Признак пересланного сообщения
    original_sender_id = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )  # ID оригинального отправителя
    original_sender = relationship(
        "User", foreign_keys=[original_sender_id]
    )  # Связь с оригинальным отправителем
    # --- КОНЕЦ ДОБАВЛЕНИЯ ---

    # Relationships
    sender = relationship(
        "User", foreign_keys=[sender_id], back_populates="sent_messages"
    )
    direct_chat = relationship("DirectChat", back_populates="messages")
    group = relationship("Group", back_populates="messages")
    read_statuses = relationship(
        "MessageReadStatus", back_populates="message", cascade="all, delete-orphan"
    )


class MessageReadStatus(Base):
    __tablename__ = "message_read_statuses"
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    read_at = Column(DateTime, default=datetime.utcnow)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True, index=True)

    # Relationships
    message = relationship("Message", back_populates="read_statuses")
    user = relationship("User")
    group = relationship("Group", back_populates="read_statuses")

    # Unique constraint to prevent a user from reading a message twice
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="_message_user_uc"),
    )
