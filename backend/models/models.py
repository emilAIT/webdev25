import uuid
from sqlalchemy import UUID, Column, LargeBinary, Integer, String, Boolean, DateTime, ForeignKey, PrimaryKeyConstraint, Text
from sqlalchemy.orm import relationship
from backend.database import Base
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_verified = Column(Boolean, default=False)
    avatar_data = Column(LargeBinary, nullable=True)
    about = Column(String, nullable=True)
    status = Column(String, nullable=True)

    devices = relationship("Device", back_populates="user", cascade="all, delete")
    my_contacts = relationship("Contact", foreign_keys="[Contact.owner_id]", back_populates="owner", cascade="all, delete")
    added_me = relationship("Contact", foreign_keys="[Contact.contact_id]", back_populates="contact")
    group_roles = relationship("GroupRole", back_populates="user")
    user_keys = relationship("UserKey", back_populates="user", uselist=False)  
    messages = relationship("Message", back_populates="sender")

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  
    device_info = Column(String)
    ip_address = Column(String)
    last_login = Column(DateTime, default=datetime.now(timezone.utc))

    user = relationship("User", back_populates="devices")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)   
    contact_id = Column(Integer, ForeignKey("users.id"), index=True)  

    owner = relationship("User", foreign_keys=[owner_id], back_populates="my_contacts")
    contact = relationship("User", foreign_keys=[contact_id], back_populates="added_me")

class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    type = Column(String, default="private")  

    messages = relationship("Message", back_populates="room", cascade="all, delete")
    participants = relationship("RoomParticipant", back_populates="room", cascade="all, delete")
    group_settings = relationship("GroupSettings", back_populates="room", uselist=False)  
    group_roles = relationship("GroupRole", back_populates="room")

class RoomParticipant(Base):
    __tablename__ = "room_participants"

    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), index=True, nullable=False)

    user = relationship("User")
    room = relationship("ChatRoom", back_populates="participants")

    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'room_id'),  
    )

class GroupRole(Base):
    __tablename__ = "group_roles"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    role = Column(String)  

    user = relationship("User", back_populates="group_roles")
    room = relationship("ChatRoom", back_populates="group_roles")

    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'room_id'), 
    )

class GroupSettings(Base):
    __tablename__ = "group_settings"

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), unique=True)
    is_public = Column(Boolean, default=False)
    can_send_media = Column(Boolean, default=True)
    allow_invite = Column(Boolean, default=True)

    room = relationship("ChatRoom", back_populates="group_settings")

class MessageReadStatus(Base):
    __tablename__ = "message_read_status"

    message_id = Column(Integer, ForeignKey("messages.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    read_at = Column(DateTime, default=datetime.now(timezone.utc))

    message = relationship("Message", back_populates="read_status")
    user = relationship("User")

# В модели Message добавляем связь с таблицей прочтений
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), index=True)
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.now(timezone.utc), index=True)
    read_status = relationship("MessageReadStatus", back_populates="message", cascade="all, delete")

    sender = relationship("User", back_populates="messages")
    room = relationship("ChatRoom", back_populates="messages")
    
# class Message(Base):
#     __tablename__ = "messages"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id"))
#     sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
#     content_encrypted = Column(Text, nullable=False)
#     sent_at = Column(DateTime, default=datetime.now(timezone.utc))
#     read = Column(Boolean, default=False)

class UserKey(Base):
    __tablename__ = "user_keys"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, nullable=False) 
    public_key = Column(String, nullable=False)  
    encrypted_private_key = Column(String, nullable=False)  

    user = relationship("User", back_populates="user_keys")
