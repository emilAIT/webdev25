from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
import re

# User related models
class UserBase(BaseModel):
    nickname: str
    email: str
    phone: str

    @field_validator('email')
    @classmethod
    def email_must_be_valid(cls, v):
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", v):
            raise ValueError('Invalid email format')
        return v
    
    @field_validator('phone')
    @classmethod
    def phone_must_be_valid(cls, v):
        if not re.match(r"^\+?[0-9]{10,15}$", v):
            raise ValueError('Invalid phone number format')
        return v

class UserCreate(UserBase):
    password: str
    recaptcha: str
    
    @field_validator('password')
    @classmethod
    def password_must_be_strong(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r"[a-z]", v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r"[0-9]", v):
            raise ValueError('Password must contain at least one number')
        return v

class UserLogin(BaseModel):
    phone: str
    password: str
    remember_me: bool = False
    recaptcha: str

class User(UserBase):
    id: int
    created_at: datetime
    profile_photo: Optional[str] = None

class ProfileUpdate(BaseModel):
    nickname: str
    email: str
    phone: str

# Token related models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    phone: Optional[str] = None
    
# User search model
class UserSearch(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None

# Chat related models
class ChatPreview(BaseModel):
    id: int
    user_name: str
    user_photo: Optional[str] = None
    latest_message: str
    timestamp: str
    unread: bool

class Message(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    content: str
    timestamp: str
    is_sent_by_me: bool

class MessageCreate(BaseModel):
    content: str
    
class ChatCreate(BaseModel):
    user_id: int

class GroupCreate(BaseModel):
    name: str
    member_ids: list[int]
    
    @field_validator('name')
    @classmethod
    def name_must_be_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Group name must be at least 3 characters long')
        return v