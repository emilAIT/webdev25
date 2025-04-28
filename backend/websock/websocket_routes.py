from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse
from typing import Dict
from backend.models.models import Message, RoomParticipant, MessageReadStatus
from backend.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from backend.auth.token_utils import verify_access_token_for_user_id, verify_access_token_for_user_id_ws
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

router_ws = APIRouter()

connected_users: Dict[int, WebSocket] = {}

@router_ws.websocket("/ws/online/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await websocket.accept()
    connected_users[user_id] = websocket

    await websocket.send_json({
        "event": "online_users_list",
        "users": list(connected_users.keys())
    })

    await notify_all_users("user_online", user_id)
    print(f"🔵 User {user_id} is online. Total connected: {len(connected_users)}")

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        connected_users.pop(user_id, None)
        await notify_all_users("user_offline", user_id)
        print(f"⚫ User {user_id} went offline. Total connected: {len(connected_users)}")

async def notify_all_users(event: str, user_id: int):
    for uid, ws in connected_users.items():
        if uid != user_id:
            try:
                print("send status")
                await ws.send_json({
                    "event": event,
                    "user_id": user_id
                })
            except:
                pass

@router_ws.websocket("/ws/chat/{room_id}")
async def chat_endpoint(
    websocket: WebSocket,
    room_id: int,
    db_session: AsyncSession = Depends(get_db)
):
    await websocket.accept()
    user_id = None

    try:
        # Получаем токен из первого сообщения
        data = await websocket.receive_json()
        token = data.get("token")
        if not token:
            await websocket.send_json({"event": "error", "message": "Missing token"})
            await websocket.close()
            return

        # Проверка токена и получение user_id
        try:
            user_id = await verify_access_token_for_user_id_ws(token)
        except Exception as e:
            await websocket.send_json({"event": "error", "message": f"Invalid token: {str(e)}"})
            await websocket.close()
            return

        # Проверяем, является ли пользователь участником комнаты
        result = await db_session.execute(
            select(RoomParticipant).filter_by(room_id=room_id, user_id=user_id)
        )
        participant = result.scalar_one_or_none()
        if not participant:
            await websocket.send_json({"event": "error", "message": "User not in this room"})
            await websocket.close()
            return

        # Загружаем историю сообщений с предзагрузкой статусов прочтения
        result = await db_session.execute(
            select(Message)
            .filter_by(room_id=room_id)
            .options(selectinload(Message.read_status))
            .order_by(Message.timestamp.asc())
        )
        messages = result.scalars().all()

        # Формируем список сообщений для отправки
        message_history = []
        for msg in messages:
            read_by = [status.user_id for status in msg.read_status]
            message_history.append({
                "sender_id": msg.sender_id,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "message_id": msg.id,
                "read_by": read_by
            })

        # Отправляем историю сообщений
        await websocket.send_json({
            "event": "message_history",
            "messages": message_history
        })

        # Добавляем пользователя в connected_users, если его там нет
        connected_users[user_id] = websocket

        # Обрабатываем новые события
        try:
            while True:
                await websocket.receive_text()  # Держим соединение открытым
        except WebSocketDisconnect:
            if user_id in connected_users:
                connected_users.pop(user_id, None)
                await notify_all_users("user_offline", user_id)
            print(f"⚫ User {user_id} disconnected from chat in room {room_id}")

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        await websocket.send_json({"event": "error", "message": "Internal server error"})
        await websocket.close()

@router_ws.websocket("/ws/send_message/{room_id}")
async def send_message_to_room(
    websocket: WebSocket,
    room_id: int,
    db_session: AsyncSession = Depends(get_db)
):
    await websocket.accept()
    sender_id = None

    try:
        while True:
            data = await websocket.receive_json()

            token = data.get("token")
            message = data.get("message", "")

            if not token:
                await websocket.send_json({"event": "error", "message": "Missing token"})
                continue

            if not message:
                await websocket.send_json({"event": "error", "message": "Message cannot be empty"})
                continue

            try:
                sender_id = await verify_access_token_for_user_id_ws(token)
            except Exception as e:
                await websocket.send_json({"event": "error", "message": f"Invalid token: {str(e)}"})
                continue

            new_message = Message(
                sender_id=sender_id,
                room_id=room_id,
                content=message,
                timestamp=datetime.now(timezone.utc)
            )
            db_session.add(new_message)
            await db_session.commit()
            await db_session.refresh(new_message)

            message_id = new_message.id
            message_timestamp = new_message.timestamp.isoformat()

            read_status = MessageReadStatus(
                message_id=message_id,
                user_id=sender_id,
                read_at=datetime.now(timezone.utc)
            )
            db_session.add(read_status)
            await db_session.commit()

            result = await db_session.execute(
                select(RoomParticipant.user_id).filter_by(room_id=room_id)
            )
            participant_ids = [row[0] for row in result.scalars().all()]

            message_data = {
                "event": "new_message",
                "sender_id": sender_id,
                "room_id": room_id,
                "message": message,
                "message_id": message_id,
                "timestamp": message_timestamp,
                "read_by": [sender_id]
            }

            for user_id in participant_ids:
                ws = connected_users.get(user_id)
                if ws:
                    try:
                        await ws.send_json(message_data)
                        print(f"Message sent to user {user_id} in room {room_id}: {message}")
                    except Exception as e:
                        print(f"Error sending message to user {user_id} in room {room_id}: {e}")
                else:
                    print(f"User {user_id} is not connected to WebSocket")

            await websocket.send_json({
                "event": "message_sent",
                "status": "success",
                "message": message
            })

    except WebSocketDisconnect:
        if sender_id:
            connected_users.pop(sender_id, None)
        print(f"⚫ User disconnected from room {room_id}")

    return JSONResponse(status_code=200, content={"message": "Message sent successfully"})

@router_ws.websocket("/ws/read_message/{room_id}/{message_id}")
async def mark_message_as_read(
    websocket: WebSocket,
    room_id: int,
    message_id: int,
    user_id: int = Depends(verify_access_token_for_user_id),
    db_session: AsyncSession = Depends(get_db)
):
    await websocket.accept()

    try:
        result = await db_session.execute(select(Message).filter_by(id=message_id))
        message = result.scalar_one_or_none()

        if not message:
            await websocket.send_json({"event": "error", "message": "Message not found"})
            return

        result = await db_session.execute(
            select(MessageReadStatus).filter_by(message_id=message_id, user_id=user_id)
        )
        read_status = result.scalar_one_or_none()

        if not read_status:
            new_read_status = MessageReadStatus(
                message_id=message_id,
                user_id=user_id,
                read_at=datetime.now(timezone.utc)
            )
            db_session.add(new_read_status)
            await db_session.commit()

        result = await db_session.execute(select(RoomParticipant).filter_by(room_id=room_id))
        room_participants = result.scalars().all()

        if len(room_participants) == len(message.read_status):
            message.read = True
            await db_session.commit()

        await notify_all_users("message_read", user_id)

        await websocket.send_json({
            "event": "message_read_status",
            "message_id": message_id,
            "status": "read"
        })

    except WebSocketDisconnect:
        print(f"⚫ User {user_id} disconnected")

    return JSONResponse(status_code=200, content={"message": "Message marked as read"})