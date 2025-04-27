from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas
from typing import List

def create_group_chat(db: Session, chat: schemas.GroupChatCreate, owner_id: int):
    """Создает новый групповой чат и добавляет участников."""
    db_chat = models.Chat(
        name=chat.name,
        is_group=True,
        owner_id=owner_id,
        avatar=chat.avatar,
        description=chat.description,
        created_at=datetime.now()
    )
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    

    db_member = models.ChatMember(
        chat_id=db_chat.id,
        user_id=owner_id,
        role="owner",
        joined_at=datetime.now()
    )
    db.add(db_member)
    
    for user_id in chat.member_ids:
        if user_id != owner_id:
            db_member = models.ChatMember(
                chat_id=db_chat.id,
                user_id=user_id,
                role="member",
                joined_at=datetime.now()
            )
            db.add(db_member)
    
    db.commit()
    return db_chat

def get_group_chat(db: Session, chat_id: int):
    """Получает групповой чат по ID."""
    return db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.is_group == True).first()

def update_group_chat(db: Session, chat_id: int, chat: schemas.GroupChatUpdate):
    """Обновляет информацию о групповом чате."""
    db_chat = get_group_chat(db, chat_id)
    if db_chat:
        for key, value in chat.dict(exclude_unset=True).items():
            setattr(db_chat, key, value)
        db.commit()
        db.refresh(db_chat)
    return db_chat

def delete_group_chat(db: Session, chat_id: int):
    """Удаляет групповой чат."""
    db_chat = get_group_chat(db, chat_id)
    if db_chat:
        db.delete(db_chat)
        db.commit()
    return db_chat

def add_group_members(db: Session, chat_id: int, user_ids: List[int]):
    """Добавляет участников в групповой чат."""
    chat = get_group_chat(db, chat_id)
    if chat:
        for user_id in user_ids:
            if not db.query(models.ChatMember).filter(
                models.ChatMember.chat_id == chat_id,
                models.ChatMember.user_id == user_id
            ).first():
                db_member = models.ChatMember(
                    chat_id=chat_id,
                    user_id=user_id,
                    role="member",
                    joined_at=datetime.now()
                )
                db.add(db_member)
        db.commit()
    return chat

def remove_group_members(db: Session, chat_id: int, user_ids: List[int]):
    """Удаляет участников из группового чата."""
    chat = get_group_chat(db, chat_id)
    if chat:
        db.query(models.ChatMember).filter(
            models.ChatMember.chat_id == chat_id,
            models.ChatMember.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.commit()
    return chat

def get_group_members(db: Session, chat_id: int):
    """Получает список участников группового чата."""
    return db.query(models.ChatMember).filter(models.ChatMember.chat_id == chat_id).all()
