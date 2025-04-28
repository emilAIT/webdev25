# schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    avatar: Optional[str]

    class Config:
        from_attributes = True  # вместо orm_mode = True

class GroupCreate(BaseModel):
    name: str
    background: Optional[str] = None
    type: Optional[str] = None

class GroupOut(BaseModel):
    id: int
    name: str
    background: Optional[str]
    type: Optional[str]

    class Config:
        from_attributes = True  # вместо orm_mode = True

class MessageCreate(BaseModel):
    content: str
    group_id: Optional[int] = None
    recipient_id: Optional[int] = None

class MessageOut(BaseModel):
    id: int
    content: str
    timestamp: datetime
    author_id: int
    group_id: Optional[int]
    recipient_id: Optional[int]
    edited: int
    author: UserOut  # Добавляем информацию об авторе

    class Config:
        from_attributes = True  # вместо orm_mode = True
        
class PrivateChatCreate(BaseModel):
    user_id: int
    recipient_id: int
    name: Optional[str] = None
    type: str = "private"