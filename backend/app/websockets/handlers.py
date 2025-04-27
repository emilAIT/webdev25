from fastapi import WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, update, or_
from datetime import datetime, timezone

from ..database.database import get_db
from ..models.models import User, DirectChat, Group, Message, MessageReadStatus
from ..services.auth import get_user_from_session
from .connection_manager import manager
from ..utils import format_last_message


async def notify_status_change(user_id: int, is_online: bool, db: Session):
    """Notify relevant users about the status change."""
    # Find all direct chats this user is part of
    direct_chats = db.scalars(
        select(DirectChat).where(
            or_(DirectChat.user1_id == user_id, DirectChat.user2_id == user_id)
        )
    ).all()

    # Find all groups this user is part of
    groups = db.scalars(
        select(Group).join(Group.members).where(User.id == user_id)
    ).all()

    # Collect unique IDs of users to notify
    user_ids_to_notify = set()
    for chat in direct_chats:
        other_user_id = chat.user2_id if chat.user1_id == user_id else chat.user1_id
        user_ids_to_notify.add(other_user_id)

    for group in groups:
        for member in group.members:
            if member.id != user_id:  # Don't notify self
                user_ids_to_notify.add(member.id)

    # Prepare notification data
    status_data = {
        "type": "user_online" if is_online else "user_offline",
        "user_id": user_id,
    }
    if not is_online:
        # Retrieve the latest last_seen from the user object
        user = db.get(User, user_id)  # Use db.get for primary key lookup
        if user and user.last_seen:
            status_data["last_seen"] = user.last_seen.isoformat()
        else:  # Fallback if user or last_seen is somehow None
            status_data["last_seen"] = datetime.now(timezone.utc).isoformat()

    # Send notification to each relevant user
    print(
        f"Notifying users {list(user_ids_to_notify)} about status change for user {user_id}"
    )
    for uid in user_ids_to_notify:
        await manager.send_personal_message(status_data, uid)


async def handle_websocket(websocket: WebSocket, user_id: int):
    """Handle WebSocket connections and messages"""
    db_session = next(get_db())
    user = db_session.get(User, user_id)
    if not user:
        await websocket.close(code=1008)
        db_session.close()
        return

    # Get cookie from websocket headers
    cookies = {}
    for header in websocket.headers.raw:
        if header[0].decode("utf-8").lower() == "cookie":
            cookie_str = header[1].decode("utf-8")
            for cookie in cookie_str.split("; "):
                try:
                    name, value = cookie.split("=", 1)
                    cookies[name] = value
                except ValueError:
                    # Ignore malformed cookies
                    print(f"Malformed cookie ignored: {cookie}")
                    pass  # Игнорируем неверно сформированные куки

    # Validate session
    session_id = cookies.get("session_id")
    if not session_id:
        print(f"Session ID not found for user {user_id}")
        await websocket.close(code=1008)
        db_session.close()
        return

    session_user_id = get_user_from_session(session_id)
    if not session_user_id or session_user_id != user_id:
        print(
            f"Invalid session for user {user_id}. Expected {user_id}, got {session_user_id}"
        )
        await websocket.close(code=1008)
        db_session.close()
        return

    # Connect the websocket
    await manager.connect(websocket, user_id)

    try:
        # Обновляем last_seen при подключении
        user.last_seen = datetime.now(timezone.utc)
        db_session.add(user)
        db_session.commit()
        print(f"Updated last_seen for user {user_id} on connect")

        # Оповещаем других пользователей, что пользователь онлайн
        await notify_status_change(user_id, is_online=True, db=db_session)

        while True:
            data = await websocket.receive_json()
            print(f"Received WebSocket message from user {user_id}: {data}")
            message_type = data.get("type")

            # Обновляем last_seen при получении любого сообщения
            try:
                user.last_seen = datetime.now(timezone.utc)
                db_session.add(user)
                db_session.commit()
            except Exception as e:
                print(
                    f"Error updating last_seen on message for user {user_id}: {str(e)}"
                )
                db_session.rollback()

            if message_type == "direct_message":
                await handle_direct_message(data, user_id, db_session)
            elif message_type == "group_message":
                await handle_group_message(data, user_id, db_session)
            elif message_type == "read_messages":
                await handle_read_messages(data, user_id, db_session)
            else:
                print(f"Unknown message type: {message_type}")

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        print(f"Error in websocket handler loop for user {user_id}: {str(e)}")
        import traceback

        traceback.print_exc()
    finally:
        print(f"Cleaning up WebSocket for user {user_id}")
        manager.disconnect(websocket, user_id)
        print(f"Connection closed for user {user_id} in finally block")
        # Обновление last_seen при нормальном закрытии
        user.last_seen = datetime.now(timezone.utc)
        # !!! ВЫЗОВ ОФЛАЙН-СТАТУСА ТЕПЕРЬ ЗДЕСЬ !!!
        await notify_status_change(user_id, False, db=db_session)
        # --- КОНЕЦ ДОБАВЛЕНИЯ ---
        db_session.commit()  # Используем db_session вместо db
        db_session.close()  # Закрываем сессию в конце


async def handle_direct_message(data: dict, user_id: int, db: Session):
    """Handle direct message between users"""
    try:
        chat_id = data.get("chat_id")
        content = data.get("content")
        reply_to_id = data.get("reply_to")

        if not chat_id or not content:
            print(f"Invalid direct message data: {data}")
            return

        # Verify chat exists and user is part of it
        chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
        if not chat:
            print(f"Chat not found: {chat_id}")
            return

        if chat.user1_id != user_id and chat.user2_id != user_id:
            print(f"User {user_id} not part of chat {chat_id}")
            return

        # --- ПРОВЕРКА: Существует ли сообщение, на которое отвечаем (в этом чате)? ---
        if reply_to_id:
            original_message = db.get(Message, reply_to_id)
            if not original_message or original_message.direct_chat_id != chat_id:
                print(
                    f"Warning: Original message (ID: {reply_to_id}) not found or not in this chat for reply by user {user_id}. Sending as regular message."
                )
                reply_to_id = None  # Игнорируем некорректный reply_to
        # --- КОНЕЦ ПРОВЕРКИ ---

        # Determine recipient
        recipient_id = chat.user2_id if chat.user1_id == user_id else chat.user1_id

        # Create message
        new_message = Message(
            direct_chat_id=chat_id,
            sender_id=user_id,
            content=content,
            timestamp=datetime.now(timezone.utc),
            reply_to_message_id=reply_to_id,
        )
        # --- ДОБАВЛЯЕМ ЛОГ ПЕРЕД СОХРАНЕНИЕМ ---
        print(
            f"WS saving direct message for chat {chat_id}. Reply_to_ID: {reply_to_id}"
        )
        # --- КОНЕЦ ЛОГА ---
        db.add(new_message)

        # Update chat's last message
        chat.last_message = format_last_message(content)
        chat.last_time = new_message.timestamp

        db.commit()
        db.refresh(new_message)

        # Get sender info
        sender = db.query(User).filter(User.id == user_id).first()
        if not sender:
            print(f"Sender not found: {user_id}")
            return

        # --- Получаем reply_info для уведомления ---
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
        # --- Конец получения reply_info ---

        # Prepare message for sending to match frontend expectations
        message_data = {
            "type": "direct_message",
            "id": new_message.id,
            "chat_id": chat_id,
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "avatar_url": sender.avatar,
            },
            "is_read": False,
            "reply_info": reply_info_ws,
        }

        # Send to both users
        print(f"Sending direct message to user {user_id} and recipient {recipient_id}")
        await manager.send_personal_message(message_data, user_id)
        await manager.send_personal_message(message_data, recipient_id)

    except Exception as e:
        print(f"Error handling direct message: {str(e)}")
        import traceback

        traceback.print_exc()


async def handle_group_message(data: dict, user_id: int, db: Session):
    """Handle messages sent to groups"""
    try:
        group_id = data.get("group_id")
        content = data.get("content")
        reply_to_id = data.get("reply_to")

        if not group_id or not content:
            print(f"Invalid group message data: {data}")
            return

        # Verify group exists and user is part of it
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            print(f"Group not found: {group_id}")
            return

        # Check if user is member of group
        member_ids = [member.id for member in group.members]
        if user_id not in member_ids:
            print(
                f"User {user_id} not member of group {group_id}. Members: {member_ids}"
            )
            return

        if reply_to_id:
            original_message = db.get(Message, reply_to_id)
            if not original_message or original_message.group_id != group_id:
                print(
                    f"Warning: Original message (ID: {reply_to_id}) not found or not in this group for reply by user {user_id}. Sending as regular message."
                )
                reply_to_id = None

        # Create message
        new_message = Message(
            group_id=group_id,
            sender_id=user_id,
            content=content,
            timestamp=datetime.now(timezone.utc),
            reply_to_message_id=reply_to_id,
        )
        # --- ДОБАВЛЯЕМ ЛОГ ПЕРЕД СОХРАНЕНИЕМ ---
        print(
            f"WS saving group message for group {group_id}. Reply_to_ID: {reply_to_id}"
        )
        # --- КОНЕЦ ЛОГА ---
        db.add(new_message)
        db.commit()
        db.refresh(new_message)

        # Get sender info
        sender = db.query(User).filter(User.id == user_id).first()
        if not sender:
            print(f"Sender not found: {user_id}")
            return

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

        # Prepare message for sending to match frontend expectations
        message_data = {
            "type": "group_message",
            "id": new_message.id,
            "group_id": group_id,
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "avatar_url": sender.avatar,
            },
            "reply_info": reply_info_ws,
        }

        # Broadcast to all group members
        print(
            f"Broadcasting group message to group {group_id} with {len(group.members)} members"
        )
        await manager.broadcast_to_group(message_data, group_id, db)

    except Exception as e:
        print(f"Error handling group message: {str(e)}")
        import traceback

        traceback.print_exc()


async def handle_read_messages(data: dict, user_id: int, db: Session):
    """Handle read receipt for messages"""
    try:
        chat_id = data.get("chat_id")
        group_id = data.get("group_id")

        if chat_id:  # Direct chat
            # Verify chat exists and user is part of it
            chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
            if not chat:
                print(f"Chat not found: {chat_id}")
                return

            if chat.user1_id != user_id and chat.user2_id != user_id:
                print(f"User {user_id} not part of chat {chat_id}")
                return

            # Mark all messages from the other user as read
            other_user_id = chat.user1_id if chat.user1_id != user_id else chat.user2_id
            unread_messages = (
                db.query(Message)
                .filter(
                    Message.direct_chat_id == chat_id,
                    Message.sender_id == other_user_id,
                    Message.is_read == False,
                )
                .all()
            )

            for msg in unread_messages:
                msg.is_read = True

            db.commit()

            # Notify the other user that messages were read
            read_notification = {
                "type": "read_receipt",
                "chat_id": chat_id,
                "reader_id": user_id,
                "timestamp": datetime.utcnow().isoformat(),
            }

            print(
                f"Sending read receipt notification to user {other_user_id} for chat {chat_id}"
            )
            await manager.send_personal_message(read_notification, other_user_id)

            # Also update the last_read_time for this user in the chat
            if chat.user1_id == user_id:
                chat.user1_last_read = datetime.utcnow()
            else:
                chat.user2_last_read = datetime.utcnow()

            db.commit()

            return {"success": True, "message": "Messages marked as read"}

        elif group_id:  # Group chat
            # Verify group exists and user is part of it
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group:
                print(f"Group not found: {group_id}")
                return

            # Check if user is member of group
            if user_id not in [member.id for member in group.members]:
                print(f"User {user_id} not member of group {group_id}")
                return

            # Получаем ID сообщений, которые пользователь УЖЕ прочитал в этой группе
            already_read_message_ids = (
                db.query(MessageReadStatus.message_id)
                .filter(
                    MessageReadStatus.group_id == group_id,
                    MessageReadStatus.user_id == user_id,
                )
                .subquery()
            )

            # Находим сообщения в группе, отправленные НЕ текущим пользователем,
            # и которых НЕТ в списке уже прочитанных
            unread_group_messages = (
                db.query(Message)
                .filter(
                    Message.group_id == group_id,
                    Message.sender_id != user_id,  # Сообщения от других
                    ~Message.id.in_(
                        already_read_message_ids
                    ),  # Не входит в already_read_message_ids
                )
                .all()
            )

            # Создаем записи о прочтении для каждого найденного сообщения
            read_time = datetime.utcnow()
            new_read_statuses = []
            for msg in unread_group_messages:
                new_status = MessageReadStatus(
                    message_id=msg.id,
                    user_id=user_id,
                    group_id=group_id,  # Добавляем group_id
                    read_at=read_time,
                )
                new_read_statuses.append(new_status)

            if new_read_statuses:
                db.add_all(new_read_statuses)
                db.commit()
                print(
                    f"Created {len(new_read_statuses)} new read status records for user {user_id} in group {group_id}"
                )
            else:
                print(
                    f"No new messages to mark as read for user {user_id} in group {group_id}"
                )

            # Notify other group members
            read_notification = {
                "type": "read_receipt",
                "group_id": group_id,
                "reader_id": user_id,
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Send notification to other group members
            for member in group.members:
                if member.id != user_id:
                    await manager.send_personal_message(read_notification, member.id)

    except Exception as e:
        print(f"Error handling read messages: {str(e)}")
        import traceback

        traceback.print_exc()
