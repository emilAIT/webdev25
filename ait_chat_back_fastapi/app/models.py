from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Table,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

# Define the association table for the many-to-many relationship
contacts_table = Table(
    "user_contacts",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("contact_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", back_populates="folders")
    groups = relationship("Group", back_populates="folder")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    registered_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    description = Column(Text, nullable=True)  # New field for user profile description
    nickname = Column(
        String(50), nullable=True, unique=True
    )  # New field for user nickname

    messages_sent = relationship(
        "Message", foreign_keys="Message.sender_id", back_populates="sender"
    )

    # Define the many-to-many relationship for contacts
    contacts = relationship(
        "User",
        secondary=contacts_table,
        primaryjoin=(contacts_table.c.user_id == id),
        secondaryjoin=(contacts_table.c.contact_id == id),
        backref="contact_of",
    )

    # Relationship with group members
    group_memberships = relationship("GroupMember", back_populates="member")

    # Relationship with group messages
    group_messages_sent = relationship("GroupMessage", back_populates="sender")

    # Relationship with folders
    folders = relationship("Folder", back_populates="owner")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # Media file fields
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=True)  # 'image', 'video', 'audio', 'document'
    media_filename = Column(String, nullable=True)
    media_size = Column(Integer, nullable=True)  # Size in bytes

    sender = relationship(
        "User", foreign_keys=[sender_id], back_populates="messages_sent"
    )


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    avatar_url = Column(String, nullable=True)

    # Relationships
    members = relationship("GroupMember", back_populates="group")
    messages = relationship("GroupMessage", back_populates="group")
    folder = relationship("Folder", back_populates="groups")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        String, nullable=False, default="member"
    )  # New field for member status

    # Relationships
    group = relationship("Group", back_populates="members")
    member = relationship("User", back_populates="group_memberships")


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # Media file fields
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=True)  # 'image', 'video', 'audio', 'document'
    media_filename = Column(String, nullable=True)
    media_size = Column(Integer, nullable=True)  # Size in bytes

    # Relationships
    group = relationship("Group", back_populates="messages")
    sender = relationship("User", back_populates="group_messages_sent")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)

    # Relationship
    user = relationship("User")
