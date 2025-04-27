from sqlalchemy.orm import Session
from db.models import Message

def send_message(db: Session, chat_id: int, sender_id: int, content: str):
    message = Message(chat_id=chat_id, sender_id=sender_id, content=content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def get_messages(db: Session, chat_id: int):
    return db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp).all()
