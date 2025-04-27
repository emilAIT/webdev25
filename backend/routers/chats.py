from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from services import chats as chat_service
from services.auth import get_current_user
from db.models import User
from pydantic import BaseModel
from typing import List

router = APIRouter()

# --------------------
# Новая схема для ответа
# --------------------
class ChatResponse(BaseModel):
    id: int
    name: str
    is_group: bool
    last_message: str = None
    last_message_time: str = None

    class Config:
        from_attribute = True

@router.post("/create_one_to_one")
def create_one_to_one_chat(target_user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return chat_service.create_one_to_one_chat(db, current_user.id, target_user_id)

@router.post("/create_group")
def create_group_chat(name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return chat_service.create_group_chat(db, current_user.id, name)

# --------------------
# Новый роут для получения чатов
# --------------------
@router.get("", response_model=List[ChatResponse])
def get_user_chats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return chat_service.get_user_chats(db, current_user.id)
