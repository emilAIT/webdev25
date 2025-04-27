from sqlalchemy.orm import Session
from db.models import Chat, ChatMember, Message

def create_one_to_one_chat(db: Session, user1_id: int, user2_id: int):
    chat = Chat(is_group=False)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    db.add_all([
        ChatMember(chat_id=chat.id, user_id=user1_id),
        ChatMember(chat_id=chat.id, user_id=user2_id)
    ])
    db.commit()

    return chat

def create_group_chat(db: Session, creator_id: int, name: str):
    chat = Chat(is_group=True, name=name)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    db.add(ChatMember(chat_id=chat.id, user_id=creator_id))
    db.commit()

    return chat

# --------------------
# Новая функция для получения чатов пользователя
# --------------------
def get_user_chats(db: Session, user_id: int):
    chats = (
        db.query(Chat)
        .join(ChatMember)
        .filter(ChatMember.user_id == user_id)
        .all()
    )

    chat_list = []
    for chat in chats:
        # Ищем последнее сообщение в чате
        last_message = (
            db.query(Message)
            .filter(Message.chat_id == chat.id)
            .order_by(Message.created_at.desc())
            .first()
        )

        chat_list.append({
            "id": chat.id,
            "name": chat.name or "Private Chat",
            "is_group": chat.is_group,
            "last_message": last_message.content if last_message else "",
            "last_message_time": last_message.created_at.strftime("%H:%M") if last_message else ""
        })

    return chat_list
