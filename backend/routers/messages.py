from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from services import messages as message_service
from services.auth import get_current_user
from db.models import User

router = APIRouter()

@router.post("/send_message")
def send_message(chat_id: int, content: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_service.send_message(db, chat_id, current_user.id, content)

@router.get("/get_messages")
def get_messages(chat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_service.get_messages(db, chat_id)
