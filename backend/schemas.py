from pydantic import BaseModel
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class ConversationCreate(BaseModel):
    name: str | None = None
    participant_ids: list[int]


class MessageCreate(BaseModel):
    conversation_id: int
    content: str


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True  # Updated from orm_mode
