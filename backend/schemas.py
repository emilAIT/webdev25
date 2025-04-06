from pydantic import BaseModel
from typing import List
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

    class Config:
        orm_mode = True


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
