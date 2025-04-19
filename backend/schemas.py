from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ConversationCreate(BaseModel):
    name: str | None = None
    participant_ids: List[int]


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    timestamp: datetime
    replied_to_id: Optional[int] = None
    is_deleted: bool = False
    # For displaying reply preview
    replied_to_content: Optional[str] = None
    replied_to_sender: Optional[int] = None

    class Config:
        orm_mode = True


class MessageCreate(BaseModel):
    content: str
    replied_to_id: Optional[int] = None


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        orm_mode = True
