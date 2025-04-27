from fastapi import (
    APIRouter,
    Depends,
    Request,
    Body,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload
from typing import List
from pathlib import Path
from datetime import datetime, timezone, timedelta
import uuid
import aiofiles
import os
from pydantic import BaseModel

from ..database.database import get_db
from ..models.models import User, DirectChat, Group, Message, MessageReadStatus
from ..services.auth import get_current_user
from ..websockets.connection_manager import (
    manager,
)  # Import the WebSocket connection manager
from ..utils import format_last_message  # <-- Добавляем импорт из utils

# Configure templates
templates_path = Path("../frontend/templates")
templates = Jinja2Templates(directory=templates_path)

# Create router for chat routes
router = APIRouter()


@router.get("/chat", response_class=HTMLResponse, include_in_schema=False)
async def chat_page(
    request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    """Render chat page with user's direct chats and groups"""
    if not user:
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)

    # Get user's direct chats
    direct_chats_q1 = db.query(DirectChat).filter(DirectChat.user1_id == user.id).all()
    direct_chats_q2 = db.query(DirectChat).filter(DirectChat.user2_id == user.id).all()

    direct_chats = []
    for chat in direct_chats_q1:
        other_user = db.query(User).filter(User.id == chat.user2_id).first()
        direct_chats.append(
            {
                "id": chat.id,
                "user": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "avatar": other_user.avatar,
                },
                "last_message": chat.last_message,
                "last_time": chat.last_time,
            }
        )

    for chat in direct_chats_q2:
        other_user = db.query(User).filter(User.id == chat.user1_id).first()
        direct_chats.append(
            {
                "id": chat.id,
                "user": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "avatar": other_user.avatar,
                },
                "last_message": chat.last_message,
                "last_time": chat.last_time,
            }
        )

    # Get user's groups
    groups = []
    for group in user.groups:
        groups.append(
            {
                "id": group.id,
                "name": group.name,
                "avatar": group.avatar,
                "description": group.description,
            }
        )

    return templates.TemplateResponse(
        "chat.html",
        {
            "request": request,
            "user": user,
            "user_id": user.id,  # добавить эту строку
            "direct_chats": direct_chats,
            "groups": groups,
        },
    )


@router.get("/current-user")
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get current user info for the frontend"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "avatar_url": current_user.avatar,
    }


@router.get("/users")
async def get_users(
    request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    """Get all users except the current user"""
    if not user:
        return {"error": "Unauthorized"}

    users = db.query(User).filter(User.id != user.id).all()
    return [{"id": u.id, "username": u.username, "avatar": u.avatar} for u in users]


@router.get("/users/search")
async def search_users(
    request: Request,
    query: str = "",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Search users by username"""
    if not user:
        return {"error": "Unauthorized"}

    search_term = f"%{query}%"
    users = (
        db.query(User)
        .filter(User.id != user.id, User.username.ilike(search_term))
        .limit(10)
        .all()
    )

    return [{"id": u.id, "username": u.username, "avatar": u.avatar} for u in users]


@router.post("/create")
async def create_chat(
    request: Request,
    user_id: int = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a direct chat between two users"""
    if not current_user:
        return {"error": "Unauthorized"}

    # Check if chat already exists
    chat1 = (
        db.query(DirectChat)
        .filter(DirectChat.user1_id == current_user.id, DirectChat.user2_id == user_id)
        .first()
    )

    chat2 = (
        db.query(DirectChat)
        .filter(DirectChat.user1_id == user_id, DirectChat.user2_id == current_user.id)
        .first()
    )

    if chat1:
        return {"chat_id": chat1.id}
    if chat2:
        return {"chat_id": chat2.id}

    # Create new chat
    new_chat = DirectChat(user1_id=current_user.id, user2_id=user_id)
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    return {"chat_id": new_chat.id}


@router.get("/direct-messages/{chat_id}")
async def get_direct_messages(
    chat_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Get all messages in a direct chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify user is part of this chat
    if chat.user1_id != current_user.id and chat.user2_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    messages = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.direct_chat_id == chat_id)
        .order_by(Message.timestamp)
        .all()
    )

    # Mark unread messages as read
    unread_messages = (
        db.query(Message)
        .filter(
            Message.direct_chat_id == chat_id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        )
        .all()
    )
    if unread_messages:
        for msg in unread_messages:
            msg.is_read = True
        db.commit()
        # Оповещение о прочтении через WebSocket
        try:
            read_notification = {
                "type": "read_receipt",
                "chat_id": chat_id,
                "reader_id": current_user.id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            other_user_id = (
                chat.user1_id if chat.user1_id != current_user.id else chat.user2_id
            )
            await manager.send_personal_message(read_notification, other_user_id)
        except Exception as ws_err:
            print(f"Error sending read receipt via WS: {ws_err}")

    message_list = []
    for msg in messages:
        reply_info = None
        if msg.reply_to_message_id:
            original_message = db.get(Message, msg.reply_to_message_id)
            if original_message:
                original_sender = db.get(User, original_message.sender_id)
                sender_name = "Unknown User"
                if original_sender:
                    sender_name = original_sender.username
                content_snippet = format_last_message(
                    original_message.content[:50]
                    + ("..." if len(original_message.content) > 50 else "")
                )

                reply_info = {
                    "id": original_message.id,
                    "sender_name": sender_name,
                    "content_snippet": content_snippet,
                }

        # Add forwarded message information if this is a forwarded message
        original_sender_info = None
        if msg.forwarded and msg.original_sender_id:
            original_sender = (
                db.query(User).filter(User.id == msg.original_sender_id).first()
            )
            if original_sender:
                original_sender_info = {
                    "id": original_sender.id,
                    "username": original_sender.username,
                    "avatar": original_sender.avatar,
                }

        message_data = {
            "id": msg.id,
            "sender": {
                "id": msg.sender.id,
                "username": msg.sender.username,
                "avatar": msg.sender.avatar,
            },
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat(),
            "is_read": msg.is_read,
            "edited": msg.edited,
            "edited_at": (msg.edited_at.isoformat() if msg.edited_at else None),
            "reply_info": reply_info,  # Добавляем информацию об ответе
            "forwarded": msg.forwarded,  # Add forwarded flag
            "original_sender": original_sender_info,  # Add original sender info
        }
        message_list.append(message_data)

    return {"messages": message_list}


@router.get("/groups/{group_id}/messages")
async def get_group_messages(
    group_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Get all messages in a group chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is member of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    messages = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.group_id == group_id)
        .order_by(Message.timestamp)
        .all()
    )

    # Mark messages as read for the current user
    unread_messages = (
        db.query(Message)
        .filter(
            Message.group_id == group_id,
            Message.sender_id != current_user.id,
            # Фильтруем сообщения, которых еще нет в MessageReadStatus для этого пользователя
            ~Message.read_statuses.any(MessageReadStatus.user_id == current_user.id),
        )
        .all()
    )

    new_read_statuses = []
    read_time = datetime.now(timezone.utc)
    for msg in unread_messages:
        new_status = MessageReadStatus(
            message_id=msg.id,
            user_id=current_user.id,
            group_id=group_id,
            read_at=read_time,
        )
        new_read_statuses.append(new_status)

    if new_read_statuses:
        db.add_all(new_read_statuses)
        db.commit()
        # Оповещение о прочтении через WebSocket
        try:
            read_notification = {
                "type": "read_receipt",
                "group_id": group_id,
                "reader_id": current_user.id,
                "timestamp": read_time.isoformat(),
            }
            # Отправляем всем участникам, кроме себя
            for member in group.members:
                if member.id != current_user.id:
                    await manager.send_personal_message(read_notification, member.id)
        except Exception as ws_err:
            print(f"Error sending group read receipt via WS: {ws_err}")

    # Prepare message list for response
    message_list = []
    for msg in messages:
        reply_info = None
        if msg.reply_to_message_id:
            original_message = db.get(Message, msg.reply_to_message_id)
            if original_message:
                original_sender = db.get(User, original_message.sender_id)
                sender_name = "Unknown User"
                if original_sender:
                    sender_name = original_sender.username
                content_snippet = format_last_message(
                    original_message.content[:50]
                    + ("..." if len(original_message.content) > 50 else "")
                )

                reply_info = {
                    "id": original_message.id,
                    "sender_name": sender_name,
                    "content_snippet": content_snippet,
                }

        # Проверяем, прочитано ли сообщение ТЕКУЩИМ пользователем
        is_read_by_current_user = any(
            status.user_id == current_user.id for status in msg.read_statuses
        )

        # Add forwarded message information if this is a forwarded message
        original_sender_info = None
        if msg.forwarded and msg.original_sender_id:
            original_sender = (
                db.query(User).filter(User.id == msg.original_sender_id).first()
            )
            if original_sender:
                original_sender_info = {
                    "id": original_sender.id,
                    "username": original_sender.username,
                    "avatar": original_sender.avatar,
                }

        message_data = {
            "id": msg.id,
            "sender": {
                "id": msg.sender.id,
                "username": msg.sender.username,
                "avatar": msg.sender.avatar,
            },
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat(),
            "is_read": is_read_by_current_user,  # Статус прочтения для текущего пользователя
            "edited": msg.edited,
            "edited_at": (msg.edited_at.isoformat() if msg.edited_at else None),
            "reply_info": reply_info,  # Добавляем информацию об ответе
            "forwarded": msg.forwarded,  # Add forwarded flag
            "original_sender": original_sender_info,  # Add original sender info
        }
        message_list.append(message_data)

    return {"messages": message_list}


@router.get("/get-chats")
async def get_chats(
    request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    """Get all chats for the current user"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get user's direct chats
    direct_chats_q1 = db.query(DirectChat).filter(DirectChat.user1_id == user.id).all()
    direct_chats_q2 = db.query(DirectChat).filter(DirectChat.user2_id == user.id).all()

    chats_list = []

    # Process direct chats where user is user1
    for chat in direct_chats_q1:
        other_user = db.query(User).filter(User.id == chat.user2_id).first()
        if not other_user:
            continue  # На случай, если пользователь удален

        # Get last message
        last_message = (
            db.query(Message)
            .filter(Message.direct_chat_id == chat.id)
            .order_by(Message.timestamp.desc())
            .first()
        )

        # Count unread messages
        unread_count = (
            db.query(Message)
            .filter(
                Message.direct_chat_id == chat.id,
                Message.sender_id != user.id,
                Message.is_read == False,
            )
            .count()
        )

        # Рассчитываем статус is_online
        is_online = False
        if other_user.last_seen:
            # Убедимся, что last_seen имеет информацию о часовом поясе
            last_seen_aware = other_user.last_seen
            if last_seen_aware.tzinfo is None:
                # Если часового пояса нет, считаем, что это UTC
                last_seen_aware = last_seen_aware.replace(tzinfo=timezone.utc)

            time_diff = datetime.now(timezone.utc) - last_seen_aware
            if (
                time_diff.total_seconds() < 60
            ):  # Считаем онлайн, если активен в последнюю минуту
                is_online = True

        chats_list.append(
            {
                "id": chat.id,
                "type": "direct",
                "user": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "avatar": other_user.avatar,
                    # Добавляем last_seen и is_online
                    "last_seen": (
                        other_user.last_seen.isoformat()
                        if other_user.last_seen
                        else None
                    ),
                    "is_online": is_online,
                },
                "last_message": (
                    format_last_message(last_message.content) if last_message else None
                ),
                "last_time": last_message.timestamp if last_message else None,
                "unread_count": unread_count,
            }
        )

    # Process direct chats where user is user2
    for chat in direct_chats_q2:
        other_user = db.query(User).filter(User.id == chat.user1_id).first()
        if not other_user:
            continue

        # Get last message
        last_message = (
            db.query(Message)
            .filter(Message.direct_chat_id == chat.id)
            .order_by(Message.timestamp.desc())
            .first()
        )

        # Count unread messages
        unread_count = (
            db.query(Message)
            .filter(
                Message.direct_chat_id == chat.id,
                Message.sender_id != user.id,
                Message.is_read == False,
            )
            .count()
        )

        # Рассчитываем статус is_online
        is_online = False
        if other_user.last_seen:
            # Убедимся, что last_seen имеет информацию о часовом поясе
            last_seen_aware = other_user.last_seen
            if last_seen_aware.tzinfo is None:
                # Если часового пояса нет, считаем, что это UTC
                last_seen_aware = last_seen_aware.replace(tzinfo=timezone.utc)

            time_diff = datetime.now(timezone.utc) - last_seen_aware
            if time_diff.total_seconds() < 60:
                is_online = True

        chats_list.append(
            {
                "id": chat.id,
                "type": "direct",
                "user": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "avatar": other_user.avatar,
                    # Добавляем last_seen и is_online
                    "last_seen": (
                        other_user.last_seen.isoformat()
                        if other_user.last_seen
                        else None
                    ),
                    "is_online": is_online,
                },
                "last_message": (
                    format_last_message(last_message.content) if last_message else None
                ),
                "last_time": last_message.timestamp if last_message else None,
                "unread_count": unread_count,
            }
        )

    # Process group chats
    for group in user.groups:
        # Get last message
        last_message = (
            db.query(Message)
            .filter(Message.group_id == group.id)
            .order_by(Message.timestamp.desc())
            .first()
        )

        # Находим ID сообщений, которые ТЕКУЩИЙ пользователь уже прочитал в этой группе
        read_message_ids_subquery = (
            db.query(MessageReadStatus.message_id)
            .filter(
                MessageReadStatus.group_id == group.id,
                MessageReadStatus.user_id == user.id,
            )
            .subquery()
        )

        # Считаем сообщения в группе, отправленные НЕ текущим пользователем,
        # и ID которых НЕТ в списке прочитанных текущим пользователем
        unread_count = (
            db.query(Message)
            .filter(
                Message.group_id == group.id,
                Message.sender_id != user.id,
                ~Message.id.in_(read_message_ids_subquery),  # Используем subquery
            )
            .count()
        )

        chats_list.append(
            {
                "id": group.id,
                "type": "group",
                "name": group.name,
                "avatar": group.avatar,
                "description": group.description,
                "last_message": (
                    format_last_message(last_message.content) if last_message else None
                ),
                "last_time": last_message.timestamp if last_message else None,
                "unread_count": unread_count,  # Теперь здесь правильный счетчик
                "participant_count": len(
                    group.members
                ),  # Добавим кол-во участников для UI
            }
        )

    # Sort chats by last message time (newest first)
    chats_list.sort(
        key=lambda x: x["last_time"] if x["last_time"] else datetime.min,
        reverse=True,
    )

    return {"chats": chats_list}


@router.get("/user-status/{user_id}")
async def get_user_status(
    user_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Get the last seen time for a specific user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Определяем статус
    now = datetime.now(timezone.utc)
    is_online = False
    if user.last_seen:
        # Убедимся, что last_seen тоже aware (на всякий случай, хотя должно быть)
        last_seen_aware = user.last_seen
        if last_seen_aware.tzinfo is None:
            last_seen_aware = last_seen_aware.replace(tzinfo=timezone.utc)

        # Считаем пользователя онлайн, если последняя активность была меньше минуты назад
        if (now - last_seen_aware) < timedelta(minutes=1):
            is_online = True

    return {
        "user_id": user.id,
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
        "is_online": is_online,
    }


# --- Определяем Pydantic модель для тела запроса ---
class SendMessageRequest(BaseModel):
    chat_id: int
    message: str
    reply_to: int | None = None  # Делаем reply_to опциональным


# --- Конец Pydantic модели ---


@router.post("/send-message")
async def send_message(
    # Используем Pydantic модель для валидации тела запроса
    message_data: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Send a message in a chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    chat_id = message_data.chat_id
    message_content = message_data.message
    reply_to_id = message_data.reply_to

    # Check if this is a direct chat
    direct_chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()

    if direct_chat:
        # Verify user is part of this direct chat
        if (
            direct_chat.user1_id != current_user.id
            and direct_chat.user2_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="You are not part of this chat")

        # --- ПРОВЕРКА: Существует ли сообщение, на которое отвечаем? ---
        if reply_to_id:
            original_message = db.get(Message, reply_to_id)
            if not original_message or (
                original_message.direct_chat_id != chat_id
                and original_message.group_id != chat_id
            ):
                # Если сообщение не найдено или оно из другого чата, не позволяем ответить
                # Можно вернуть ошибку или просто игнорировать reply_to_id
                print(
                    f"Warning: Original message (ID: {reply_to_id}) not found or not in this chat for reply by user {current_user.id}. Sending as regular message."
                )
                reply_to_id = None  # Игнорируем некорректный reply_to
        # --- КОНЕЦ ПРОВЕРКИ ---

        # Create new message
        new_message = Message(
            content=message_content,
            sender_id=current_user.id,
            direct_chat_id=chat_id,
            timestamp=datetime.now(timezone.utc),  # Используем now() с таймзоной
            is_read=False,
            reply_to_message_id=reply_to_id,  # Добавляем ID ответа
        )

        # --- ДОБАВЛЯЕМ ЛОГ ПЕРЕД СОХРАНЕНИЕМ ---
        print(f"Saving message for chat {chat_id}. Reply_to_ID: {reply_to_id}")
        # --- КОНЕЦ ЛОГА ---

        # Update last message in chat
        # Используем форматированный контент для last_message, если это файл
        direct_chat.last_message = format_last_message(message_content)
        direct_chat.last_time = new_message.timestamp

    else:
        # --- ОБРАБОТКА ГРУПП: Либо ошибка, либо отдельный эндпоинт ---
        # В текущей реализации этот эндпоинт только для личных чатов.
        # Если chat_id не найден среди DirectChat, возвращаем ошибку.
        raise HTTPException(status_code=404, detail="Direct chat not found")
        # --- КОНЕЦ ОБРАБОТКИ ГРУПП ---

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    # --- WebSocket Notification (Важно!) ---
    # Отправляем уведомление через WebSocket, чтобы сообщение появилось у получателя
    try:
        recipient_id = (
            direct_chat.user1_id
            if direct_chat.user1_id != current_user.id
            else direct_chat.user2_id
        )
        # Получаем reply_info для уведомления (аналогично get_direct_messages)
        reply_info_ws = None
        if new_message.reply_to_message_id:
            original_message_ws = db.get(Message, new_message.reply_to_message_id)
            if original_message_ws:
                original_sender_ws = db.get(User, original_message_ws.sender_id)
                reply_info_ws = {
                    "id": original_message_ws.id,
                    "sender_name": (
                        original_sender_ws.username
                        if original_sender_ws
                        else "Unknown User"
                    ),
                    "content_snippet": format_last_message(
                        original_message_ws.content[:50]
                        + ("..." if len(original_message_ws.content) > 50 else "")
                    ),
                }

        ws_message_data = {
            "type": "direct_message",
            "id": new_message.id,
            "chat_id": chat_id,
            "sender": {
                "id": current_user.id,
                "username": current_user.username,
                "avatar": current_user.avatar,
            },
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
            "is_read": False,  # Новое сообщение не прочитано получателем
            "edited": new_message.edited,
            "edited_at": (
                new_message.edited_at.isoformat() if new_message.edited_at else None
            ),
            "reply_info": reply_info_ws,  # Добавляем инфо об ответе в WS
        }
        # Отправляем себе и получателю
        await manager.send_personal_message(ws_message_data, current_user.id)
        await manager.send_personal_message(ws_message_data, recipient_id)
        print(
            f"Sent WS notification for message {new_message.id} to users {current_user.id} and {recipient_id}"
        )
    except Exception as ws_error:
        print(f"Failed to send WebSocket notification for new message: {ws_error}")
        # Не прерываем выполнение, HTTP ответ все равно уйдет
    # --- Конец WebSocket Notification ---

    return {"success": True, "message_id": new_message.id}


@router.post("/avatar")
async def upload_avatar(
    request: Request,
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload user avatar"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # Проверяем формат файла
        content_type = avatar.content_type
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail="Загружаемый файл должен быть изображением"
            )

        # Создаем директорию для хранения аватаров, если она не существует
        avatar_dir = Path("../frontend/static/images/avatars")
        avatar_dir.mkdir(exist_ok=True, parents=True)

        # Генерируем уникальное имя файла
        filename = f"user_{current_user.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        extension = content_type.split("/")[1]
        if extension == "jpeg":
            extension = "jpg"

        # Полный путь к файлу
        file_path = avatar_dir / f"{filename}.{extension}"

        # Относительный путь для сохранения в БД
        relative_path = f"/static/images/avatars/{filename}.{extension}"

        # Читаем и сохраняем содержимое файла
        contents = await avatar.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        # Обновляем аватар пользователя в БД
        current_user.avatar = relative_path
        db.commit()

        return {
            "success": True,
            "avatar_url": relative_path,
            "message": "Аватар успешно обновлен",
        }
    except Exception as e:
        # Логируем исключение
        print(f"Ошибка при загрузке аватара: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Ошибка при загрузке аватара: {str(e)}"
        )


@router.get("/profile")
async def get_user_profile(
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get current user profile"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "avatar_url": current_user.avatar,
        "created_at": current_user.created_at,
    }


@router.put("/profile")
async def update_user_profile(
    request: Request,
    profileData: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update user profile"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # Получаем данные из запроса
        username = profileData.get("username")
        email = profileData.get("email")
        password = profileData.get("password")

        # Проверяем обязательные поля
        if not username or not email:
            raise HTTPException(
                status_code=400, detail="Имя пользователя и email обязательны"
            )

        # Проверяем уникальность имени пользователя
        if username != current_user.username:
            existing_user = db.query(User).filter(User.username == username).first()
            if existing_user:
                raise HTTPException(
                    status_code=400, detail="Имя пользователя уже занято"
                )

        # Проверяем уникальность email
        if email != current_user.email:
            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email:
                raise HTTPException(status_code=400, detail="Email уже используется")

        # Обновляем данные пользователя
        current_user.username = username
        current_user.email = email

        # Если указан новый пароль, обновляем его
        if password and len(password) >= 6:
            from ..services.auth import hash_password

            current_user.password = hash_password(password)

        # Сохраняем изменения
        db.commit()

        return {
            "success": True,
            "message": "Профиль успешно обновлен",
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "avatar_url": current_user.avatar,
            },
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Ошибка при обновлении профиля: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Ошибка при обновлении профиля: {str(e)}"
        )


@router.put("/messages/{message_id}")
async def update_message(
    message_id: int,
    content: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update a message content"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Find the message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Verify user is the sender of this message
    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You can only edit your own messages"
        )

    # Update message content
    message.content = content.get("content")
    message.edited = True
    message.edited_at = datetime.now()

    # Save changes
    db.commit()

    # Determine if this is a direct chat or group message
    chat_id = message.direct_chat_id
    group_id = message.group_id
    is_group = group_id is not None

    # Send WebSocket notification about edited message
    try:
        # Prepare the message data for notification
        ws_data = {
            "type": "message_edited",
            "message_id": message.id,
            "content": message.content,
            "chat_id": chat_id,
            "group_id": group_id,
            "edited_at": message.edited_at.isoformat(),
            "edited_by": current_user.id,
        }

        if is_group:
            # For group messages, broadcast to all members
            await manager.broadcast_to_group(ws_data, group_id, db)
            print(f"WebSocket notification sent for edited message to group {group_id}")
        else:
            # For direct messages, send to both participants
            direct_chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
            if direct_chat:
                # Send to both the sender and recipient
                recipient_id = (
                    direct_chat.user2_id
                    if direct_chat.user1_id == current_user.id
                    else direct_chat.user1_id
                )
                await manager.send_personal_message(ws_data, current_user.id)
                await manager.send_personal_message(ws_data, recipient_id)
                print(
                    f"WebSocket notification sent for edited message in chat {chat_id} to users {current_user.id} and {recipient_id}"
                )
    except Exception as e:
        print(f"Error sending WebSocket notification for edited message: {str(e)}")
        # We don't fail the request if WebSocket notification fails

    return {
        "success": True,
        "message": "Message updated successfully",
        "data": {
            "id": message.id,
            "content": message.content,
            "edited": message.edited,
            "edited_at": message.edited_at.isoformat() if message.edited_at else None,
        },
    }


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete a message"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Find the message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Verify user is the sender of this message
    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You can only delete your own messages"
        )

    # Store chat info before deleting
    chat_id = message.direct_chat_id
    group_id = message.group_id
    is_group = group_id is not None

    if chat_id:
        chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
        # Check if we need to update the last_message in the chat
        last_message = (
            db.query(Message)
            .filter(Message.direct_chat_id == chat_id)
            .order_by(Message.timestamp.desc())
            .first()
        )
        if last_message and last_message.id == message_id:
            # This is the last message in the chat, need to update
            next_last_message = (
                db.query(Message)
                .filter(Message.direct_chat_id == chat_id, Message.id != message_id)
                .order_by(Message.timestamp.desc())
                .first()
            )
            if next_last_message:
                chat.last_message = next_last_message.content
                chat.last_time = next_last_message.timestamp
            else:
                chat.last_message = None
                chat.last_time = None

    # Delete the message
    db.delete(message)
    db.commit()

    # Send WebSocket notification about deleted message
    try:
        # Prepare the message data for notification
        ws_data = {
            "type": "message_deleted",
            "message_id": message_id,
            "chat_id": chat_id,
            "group_id": group_id,
            "deleted_by": current_user.id,
            "timestamp": datetime.now().isoformat(),
        }

        if is_group:
            # For group messages, broadcast to all members
            await manager.broadcast_to_group(ws_data, group_id, db)
            print(
                f"WebSocket notification sent for deleted message to group {group_id}"
            )
        else:
            # For direct messages, send to both participants
            direct_chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
            if direct_chat:
                # Send to both the sender and recipient
                recipient_id = (
                    direct_chat.user2_id
                    if direct_chat.user1_id == current_user.id
                    else direct_chat.user1_id
                )
                await manager.send_personal_message(ws_data, current_user.id)
                await manager.send_personal_message(ws_data, recipient_id)
                print(
                    f"WebSocket notification sent for deleted message in chat {chat_id} to users {current_user.id} and {recipient_id}"
                )
    except Exception as e:
        print(f"Error sending WebSocket notification for deleted message: {str(e)}")
        # We don't fail the request if WebSocket notification fails

    return {"success": True, "message": "Message deleted successfully"}


@router.post("/forward-message")
async def forward_message(
    message_id: int = Body(...),
    target_chat_id: int = Body(...),
    is_group: bool = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Forward a message to another chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Find the message to forward
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get the original sender info (either from original_sender or the sender)
    original_sender_id = (
        message.original_sender_id if message.forwarded else message.sender_id
    )

    # Create new message in target chat
    if is_group:
        # Verify user is member of the target group
        group = db.query(Group).filter(Group.id == target_chat_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Target group not found")

        if current_user not in group.members:
            raise HTTPException(
                status_code=403, detail="You are not a member of this group"
            )

        new_message = Message(
            content=message.content,
            sender_id=current_user.id,
            group_id=target_chat_id,
            timestamp=datetime.now(timezone.utc),
            is_read=False,
            forwarded=True,
            original_sender_id=original_sender_id,
        )

    else:
        # Verify user is part of the target direct chat
        direct_chat = (
            db.query(DirectChat).filter(DirectChat.id == target_chat_id).first()
        )
        if not direct_chat:
            raise HTTPException(status_code=404, detail="Target chat not found")

        if (
            direct_chat.user1_id != current_user.id
            and direct_chat.user2_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="You are not part of this chat")

        new_message = Message(
            content=message.content,
            sender_id=current_user.id,
            direct_chat_id=target_chat_id,
            timestamp=datetime.now(timezone.utc),
            is_read=False,
            forwarded=True,
            original_sender_id=original_sender_id,
        )

        # Update last message in chat
        direct_chat.last_message = "Forwarded message"
        direct_chat.last_time = new_message.timestamp

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    # Send WebSocket notification about forwarded message
    try:
        # Prepare message data for WebSocket notification
        sender_info = {
            "id": current_user.id,
            "username": current_user.username,
            "avatar": current_user.avatar,
        }

        # Get the original sender info
        original_sender = db.query(User).filter(User.id == original_sender_id).first()
        original_sender_info = None
        if original_sender:
            original_sender_info = {
                "id": original_sender.id,
                "username": original_sender.username,
                "avatar": original_sender.avatar,
            }

        message_data = {
            "id": new_message.id,
            "sender": sender_info,
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
            "is_read": False,
            "forwarded": True,
            "original_sender": original_sender_info,
        }

        if is_group:
            # For group messages
            ws_message = {
                "type": "group_message",
                "group_id": target_chat_id,
                **message_data,
            }
            # Broadcast to all group members
            await manager.broadcast_to_group(ws_message, target_chat_id, db)
            print(
                f"WebSocket notification sent for forwarded message to group {target_chat_id}"
            )
        else:
            # For direct messages
            ws_message = {
                "type": "direct_message",
                "chat_id": target_chat_id,
                **message_data,
            }
            # Get the other user's ID in the direct chat
            recipient_id = (
                direct_chat.user2_id
                if direct_chat.user1_id == current_user.id
                else direct_chat.user1_id
            )

            # Send to both the sender and the recipient
            await manager.send_personal_message(ws_message, current_user.id)
            await manager.send_personal_message(ws_message, recipient_id)
            print(
                f"WebSocket notification sent for forwarded message in chat {target_chat_id} to users {current_user.id} and {recipient_id}"
            )
    except Exception as e:
        print(f"Error sending WebSocket notification for forwarded message: {str(e)}")
        # Don't fail the request if WebSocket notification fails

    return {
        "success": True,
        "message": "Message forwarded successfully",
        "new_message_id": new_message.id,
    }


@router.post("/upload-file")
async def upload_file(
    chat_id: int = Form(...),
    is_group: bool = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload a file and send it as a message"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Определяем директорию для загрузки
    # Убедитесь, что путь корректен относительно места запуска вашего FastAPI приложения
    upload_dir = Path("../frontend/static/media/chat_files")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Генерируем уникальное имя файла, сохраняя расширение
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = upload_dir / filename
    file_url = f"/static/media/chat_files/{filename}"  # Относительный URL для доступа из фронтенда

    try:
        # Асинхронно сохраняем файл
        async with aiofiles.open(file_path, "wb") as out_file:
            content = await file.read()  # Читаем содержимое файла
            await out_file.write(content)  # Записываем в файл на диске
    except Exception as e:
        print(f"Ошибка сохранения файла: {e}")
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    # Создаем сообщение в базе данных
    new_message = Message(
        sender_id=current_user.id,
        content=file_url,  # Сохраняем URL файла как контент сообщения
        timestamp=datetime.now(timezone.utc),
        is_read=False,  # Сообщение изначально не прочитано
        # Указываем тип контента как 'file' (потребует добавления поля в модель Message)
        # message_type='file' # Раскомментируйте, если добавите поле
    )

    if is_group:
        group = db.query(Group).filter(Group.id == chat_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if current_user not in group.members:
            raise HTTPException(
                status_code=403, detail="You are not a member of this group"
            )
        new_message.group_id = chat_id
        # Обновляем last_message/last_time для группы (по желанию)
        # group.last_message = f"File: {file.filename}"
        # group.last_time = new_message.timestamp
    else:
        direct_chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
        if not direct_chat:
            raise HTTPException(status_code=404, detail="Direct chat not found")
        if (
            direct_chat.user1_id != current_user.id
            and direct_chat.user2_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="You are not part of this chat")
        new_message.direct_chat_id = chat_id
        # Обновляем last_message/last_time для чата
        direct_chat.last_message = f"File: {file.filename}"  # Отображаем имя файла
        direct_chat.last_time = new_message.timestamp

    try:
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
    except Exception as e:
        db.rollback()
        print(f"Ошибка сохранения сообщения в БД: {e}")
        raise HTTPException(
            status_code=500, detail=f"Could not save message to database: {e}"
        )

    # Возвращаем информацию о созданном сообщении (аналогично get_direct_messages)
    sender_info = {
        "id": current_user.id,
        "username": current_user.username,
        "avatar": current_user.avatar,
    }

    # Prepare message data for WebSocket notification
    message_data = {
        "id": new_message.id,
        "sender": sender_info,
        "content": new_message.content,  # URL файла
        "timestamp": new_message.timestamp.isoformat(),
        "is_read": False,
    }

    # Send WebSocket notification
    try:
        if is_group:
            # For group messages
            ws_message = {"type": "group_message", "group_id": chat_id, **message_data}
            # Broadcast to all group members
            await manager.broadcast_to_group(ws_message, chat_id, db)
            print(f"WebSocket notification sent for file upload to group {chat_id}")
        else:
            # For direct messages
            ws_message = {"type": "direct_message", "chat_id": chat_id, **message_data}
            # Get the other user's ID in the direct chat
            recipient_id = (
                direct_chat.user2_id
                if direct_chat.user1_id == current_user.id
                else direct_chat.user1_id
            )

            # Send to both the sender and the recipient
            await manager.send_personal_message(ws_message, current_user.id)
            await manager.send_personal_message(ws_message, recipient_id)
            print(
                f"WebSocket notification sent for file upload in chat {chat_id} to users {current_user.id} and {recipient_id}"
            )
    except Exception as e:
        print(f"Error sending WebSocket notification for file upload: {str(e)}")
        # We don't raise an exception here as the file upload was successful
        # The client will still get the HTTP response

    return {
        "success": True,
        "message": {
            "id": new_message.id,
            "sender": sender_info,
            "content": new_message.content,  # URL файла
            "timestamp": new_message.timestamp.isoformat(),
            "is_read": False,
            # "message_type": new_message.message_type # Раскомментируйте, если добавили поле
        },
    }


@router.delete("/{chat_id}/clear")
async def clear_chat_messages(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Clear all messages in a direct chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if this is a direct chat
    direct_chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
    if not direct_chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify user is part of this direct chat
    if (
        direct_chat.user1_id != current_user.id
        and direct_chat.user2_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="You are not part of this chat")

    # Get the other user in the chat
    other_user_id = (
        direct_chat.user1_id
        if direct_chat.user1_id != current_user.id
        else direct_chat.user2_id
    )

    try:
        # Delete all messages in the chat
        num_deleted = (
            db.query(Message).filter(Message.direct_chat_id == chat_id).delete()
        )

        # Reset the last message and time in the chat
        direct_chat.last_message = None
        direct_chat.last_time = None

        db.commit()

        # Send WebSocket notification to both users using the dedicated method
        try:
            from ..websockets.connection_manager import manager

            await manager.broadcast_chat_cleared(chat_id, current_user.id, db)

            print(f"WebSocket notification sent for chat clear in chat {chat_id}")
        except Exception as e:
            print(f"Error sending WebSocket notification for chat clear: {str(e)}")

        return {
            "success": True,
            "message": f"Successfully cleared {num_deleted} messages from chat",
        }
    except Exception as e:
        db.rollback()
        print(f"Error clearing messages in chat {chat_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database error while clearing messages: {str(e)}"
        )


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete an entire direct chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if this is a direct chat
    direct_chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
    if not direct_chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify user is part of this direct chat
    if (
        direct_chat.user1_id != current_user.id
        and direct_chat.user2_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="You are not part of this chat")

    # Get the other user in the chat
    other_user_id = (
        direct_chat.user1_id
        if direct_chat.user1_id != current_user.id
        else direct_chat.user2_id
    )

    try:
        # First delete all messages in the chat
        db.query(Message).filter(Message.direct_chat_id == chat_id).delete()

        # Then delete the chat itself
        db.delete(direct_chat)
        db.commit()

        # Send WebSocket notification to both users
        try:
            ws_data = {
                "type": "chat_deleted",
                "chat_id": chat_id,
                "deleted_by": current_user.id,
                "timestamp": datetime.now().isoformat(),
            }

            from ..websockets.connection_manager import manager

            await manager.send_personal_message(ws_data, current_user.id)
            await manager.send_personal_message(ws_data, other_user_id)

            print(
                f"WebSocket notification sent for chat deletion in chat {chat_id} to users {current_user.id} and {other_user_id}"
            )
        except Exception as e:
            print(f"Error sending WebSocket notification for chat deletion: {str(e)}")

        return {"success": True, "message": "Chat successfully deleted"}
    except Exception as e:
        db.rollback()
        print(f"Error deleting chat {chat_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database error while deleting chat: {str(e)}"
        )
