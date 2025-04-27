import json
import os
import asyncio
from datetime import timedelta, datetime, timezone
from typing import List, Dict, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
    Path,
    Query,
    File,
    UploadFile,
    Form,
)
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import or_, and_
from pathlib import Path as PathLib

from . import models, schemas
from .database import get_db, SessionLocal
from .auth import get_current_user # Need this for WS auth
from .storage import (
    storage_client,
    ALLOWED_MEDIA_TYPES,
    MAX_FILE_SIZE,
    LOCAL_STORAGE_PATH,
    STORAGE_TYPE,
    GCP_BUCKET_NAME,
    LocalStorageClient,
)

router = APIRouter()

# WebSocket connection manager - Defined within chat_service
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.ping_interval = 30  # seconds between ping messages
        self.ping_timeout = 10  # seconds to wait for pong response
        self.ping_tasks = {}  # store ping tasks for each connection

    async def connect(self, websocket: WebSocket, user_id: int, db: Session):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if db_user:
            db_user.is_online = True
            db.commit()
            status_payload = {
                "action": "status_update",
                "payload": {
                    "user_id": user_id,
                    "status_type": "online",
                    "status_value": True,
                },
            }
            await self.broadcast(json.dumps(status_payload))

        self.ping_tasks[user_id] = asyncio.create_task(
            self.keep_alive(user_id, websocket)
        )

    async def disconnect(self, user_id: int, db: Session):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.ping_tasks:
            self.ping_tasks[user_id].cancel()
            del self.ping_tasks[user_id]

        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        last_seen_time = None
        if db_user:
            db_user.is_online = False
            db_user.last_seen = datetime.now(timezone.utc)
            db.commit()
            db.refresh(db_user)
            last_seen_time = db_user.last_seen.isoformat()
            status_payload = {
                "action": "status_update",
                "payload": {
                    "user_id": user_id,
                    "status_type": "online",
                    "status_value": False,
                    "last_seen": last_seen_time,
                },
            }
            await self.broadcast(json.dumps(status_payload))

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
                return True
            except Exception:
                return False
        return False

    async def send_to_group(
        self,
        message: str,
        group_id: int,
        db: Session,
        exclude_sender_id: Optional[int] = None,
    ):
        member_ids = (
            db.query(models.GroupMember.member_id)
            .filter(models.GroupMember.group_id == group_id)
            .all()
        )
        member_ids = [m[0] for m in member_ids]
        print(f"Sending message to group {group_id}, members: {member_ids}")

        for user_id in member_ids:
            if exclude_sender_id is None or user_id != exclude_sender_id:
                if user_id in self.active_connections:
                    await self.send_personal_message(message, user_id)
                else:
                    print(f"User {user_id} in group {group_id} is not connected.")

    async def broadcast(self, message: str, exclude_user_id: Optional[int] = None):
        disconnected_users = []
        active_users = list(self.active_connections.items())

        for user_id, connection in active_users:
            if exclude_user_id is None or user_id != exclude_user_id:
                try:
                    await connection.send_text(message)
                except Exception:
                    print(
                        f"Error broadcasting to user {user_id}, adding to disconnect list."
                    )
                    disconnected_users.append(user_id)
        # Disconnects handled elsewhere

    async def keep_alive(self, user_id: int, websocket: WebSocket):
        try:
            while True:
                await asyncio.sleep(self.ping_interval)
                try:
                    ping_message = json.dumps(
                        {"action": "ping", "timestamp": datetime.utcnow().isoformat()}
                    )
                    await websocket.send_text(ping_message)
                except Exception:
                    print(f"Ping failed for user {user_id}, connection may be lost.")
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error in keep_alive for user {user_id}: {e}")

# Instantiate the manager for use within this service
manager = ConnectionManager()

# WebSocket Endpoint
@router.websocket("/ws/{token}")
async def websocket_endpoint(
    websocket: WebSocket, token: str, db: Session = Depends(get_db)
):
    user: Optional[models.User] = None
    user_id: Optional[int] = None
    try:
        user = await get_current_user(token=token, db=db)
        user_id = user.id
        print(
            f"WebSocket connection authenticated for user: {user.username} ({user_id})"
        )
        await manager.connect(websocket, user.id, db)

        while True:
            data = await websocket.receive_text()
            print(f"Received message from {user_id}: {data}")
            try:
                message_data = json.loads(data)
                action = message_data.get("action")
                payload = message_data.get("payload", {})

                if action == "pong":
                    continue
                elif action == "message":
                    content = payload.get("content", "")
                    recipient_id = payload.get("recipient_id")
                    media_url = payload.get("media_url")
                    media_type = payload.get("media_type")
                    media_filename = payload.get("media_filename")
                    media_size = payload.get("media_size")

                    if not content and not media_url:
                        print(f"Warning: Received empty message payload from {user_id}")
                        continue

                    if recipient_id:
                        recipient_user = (
                            db.query(models.User)
                            .filter(models.User.id == recipient_id)
                            .first()
                        )
                        if recipient_user:
                            is_sender_contact = (
                                db.query(models.contacts_table)
                                .filter(
                                    models.contacts_table.c.user_id == recipient_id,
                                    models.contacts_table.c.contact_id == user.id,
                                )
                                .first()
                            )
                            is_recipient_contact = (
                                db.query(models.contacts_table)
                                .filter(
                                    models.contacts_table.c.user_id == user.id,
                                    models.contacts_table.c.contact_id == recipient_id,
                                )
                                .first()
                            )
                            needs_commit = False
                            if not is_sender_contact:
                                recipient_user.contacts.append(user)
                                needs_commit = True
                            if not is_recipient_contact:
                                user.contacts.append(recipient_user)
                                needs_commit = True
                            if needs_commit:
                                db.commit()
                                print(
                                    f"Added user {user_id} and {recipient_id} as contacts"
                                )
                        else:
                            print(f"Warning: Recipient user {recipient_id} not found")

                    db_message = models.Message(
                        content=content,
                        sender_id=user.id,
                        recipient_id=recipient_id,
                        timestamp=datetime.now(timezone.utc),
                        media_url=media_url,
                        media_type=media_type,
                        media_filename=media_filename,
                        media_size=media_size,
                    )
                    db.add(db_message)
                    db.commit()
                    db.refresh(db_message)

                    message_payload = {
                        "id": db_message.id,
                        "content": db_message.content,
                        "sender_id": db_message.sender_id,
                        "recipient_id": db_message.recipient_id,
                        "timestamp": db_message.timestamp.isoformat(),
                        "sender": {
                            "id": user.id,
                            "username": user.username,
                            "email": user.email,
                            "is_online": user.is_online,
                        },
                    }
                    if media_url:
                        message_payload.update(
                            {
                                "media_url": media_url,
                                "media_type": media_type,
                                "media_filename": media_filename,
                                "media_size": media_size,
                            }
                        )
                    message_to_send = {"action": "message", "payload": message_payload}

                    if recipient_id:
                        await manager.send_personal_message(
                            json.dumps(message_to_send), recipient_id
                        )
                        await manager.send_personal_message(
                            json.dumps(message_to_send), user.id
                        )
                    else:
                        await manager.broadcast(json.dumps(message_to_send))

                elif action == "group_message":
                    group_id = payload.get("group_id")
                    content = payload.get("content", "").strip()
                    media_url = payload.get("media_url")
                    media_type = payload.get("media_type")
                    media_filename = payload.get("media_filename")
                    media_size = payload.get("media_size")

                    if not group_id or (not content and not media_url):
                        print(f"Warning: Invalid group_message payload from {user_id}")
                        continue

                    is_member = (
                        db.query(models.GroupMember)
                        .filter(
                            models.GroupMember.group_id == group_id,
                            models.GroupMember.member_id == user.id,
                        )
                        .first()
                    )
                    if not is_member:
                        print(
                            f"Warning: User {user_id} tried to send to group {group_id} but is not a member."
                        )
                        continue

                    db_group_message = models.GroupMessage(
                        content=content,
                        sender_id=user.id,
                        group_id=group_id,
                        timestamp=datetime.now(timezone.utc),
                        media_url=media_url,
                        media_type=media_type,
                        media_filename=media_filename,
                        media_size=media_size,
                    )
                    db.add(db_group_message)
                    db.commit()
                    db.refresh(db_group_message)

                    message_to_send = json.dumps(
                        {
                            "action": "group_message",
                            "payload": {
                                "id": db_group_message.id,
                                "content": db_group_message.content,
                                "group_id": group_id,
                                "timestamp": db_group_message.timestamp.isoformat(),
                                "sender": {
                                    "id": user.id,
                                    "username": user.username,
                                },
                                "media_url": media_url,
                                "media_type": media_type,
                                "media_filename": media_filename,
                                "media_size": media_size,
                            },
                        }
                    )

                    await manager.send_to_group(
                        message_to_send, group_id, db, exclude_sender_id=user.id
                    )
                    await manager.send_personal_message(message_to_send, user.id)

                elif action == "group_typing" or action == "group_stopped_typing":
                    group_id = payload.get("group_id")
                    if not group_id:
                        print(f"Warning: Invalid group typing payload from {user_id}")
                        continue
                    is_member = (
                        db.query(models.GroupMember)
                        .filter(
                            models.GroupMember.group_id == group_id,
                            models.GroupMember.member_id == user.id,
                        )
                        .first()
                    )
                    if not is_member:
                        continue
                    typing_payload = {
                        "action": "group_typing_update",
                        "payload": {
                            "group_id": group_id,
                            "user_id": user.id,
                            "username": user.username,
                            "is_typing": action == "group_typing",
                        },
                    }
                    await manager.send_to_group(
                        json.dumps(typing_payload),
                        group_id,
                        db,
                        exclude_sender_id=user.id,
                    )

                elif action == "typing" or action == "stopped_typing":
                    typing_payload = {
                        "action": "typing_update",
                        "payload": {
                            "user_id": user.id,
                            "username": user.username,
                            "is_typing": action == "typing",
                        },
                    }
                    await manager.broadcast(
                        json.dumps(typing_payload), exclude_user_id=user.id
                    )

                elif action == "mark_read":
                    sender_id_to_mark = payload.get("sender_id")
                    if sender_id_to_mark:
                        print(
                            f"User {user_id} marking messages from {sender_id_to_mark} as read."
                        )
                        read_time = datetime.now(timezone.utc)
                        updated_count = (
                            db.query(models.Message)
                            .filter(
                                and_(
                                    models.Message.sender_id == sender_id_to_mark,
                                    models.Message.recipient_id == user_id,
                                    models.Message.read_at.is_(None),
                                )
                            )
                            .update({"read_at": read_time}, synchronize_session=False)
                        )
                        db.commit()
                        print(f"Marked {updated_count} messages as read.")

                        read_notification_payload = {
                            "action": "messages_read",
                            "payload": {
                                "sender_id": sender_id_to_mark,
                                "reader_id": user_id,
                                "read_at": read_time.isoformat(),
                            },
                        }
                        await manager.send_personal_message(
                            json.dumps(read_notification_payload), sender_id_to_mark
                        )
                    else:
                        print(
                            f"Warning: Received 'mark_read' action without sender_id from {user_id}"
                        )
                else:
                    print(f"Warning: Unknown action received from {user_id}: {action}")

            except json.JSONDecodeError:
                print(f"Error: Received invalid JSON from {user_id}: {data}")
            except Exception as e:
                print(f"Error processing message inside loop for {user_id}: {e}")

    except WebSocketDisconnect:
        print(f"WebSocket disconnected normally for user: {user_id}")
    except Exception as e:
        print(
            f"WebSocket connection error for user {user_id if user_id else 'Unknown'}: {e}"
        )
        try:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        except RuntimeError as re:
            print(f"Error closing websocket, possibly already closed: {re}")
        except Exception as close_exc:
            print(f"Generic error closing websocket: {close_exc}")
    finally:
        if user_id:
            print(f"Cleaning up connection for user: {user_id}")
            await manager.disconnect(user_id, db)

# Message/Conversation History Endpoint
@router.get("/conversations/{other_user_id}", response_model=List[schemas.Message])
async def get_conversation_history(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    limit: int = 100,
):
    other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="Other user not found")

    messages = (
        db.query(models.Message)
        .filter(
            or_(
                (models.Message.sender_id == current_user.id)
                & (models.Message.recipient_id == other_user_id),
                (models.Message.sender_id == other_user_id)
                & (models.Message.recipient_id == current_user.id),
            )
        )
        .order_by(models.Message.timestamp.asc())
        .limit(limit)
        .all()
    )
    return messages

# Delete Direct Chat History Endpoint
@router.delete("/conversations/{other_user_id}", response_model=dict)
async def delete_direct_chat_history(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted_count = (
        db.query(models.Message)
        .filter(
            or_(
                and_(
                    models.Message.sender_id == current_user.id,
                    models.Message.recipient_id == other_user_id,
                ),
                and_(
                    models.Message.sender_id == other_user_id,
                    models.Message.recipient_id == current_user.id,
                ),
            )
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {
        "message": f"Deleted {deleted_count} messages between you and user {other_user_id}"
    }

# Media File Endpoints
@router.post("/upload-media", response_model=schemas.MediaFileResponse)
async def upload_media_file(
    file: UploadFile = File(...),
    folder: str = Form("general"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    file_size = 0
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE/1024/1024:.1f}MB",
        )

    try:
        if STORAGE_TYPE == "gcp" and (
            not hasattr(storage_client, "client")
            or not hasattr(storage_client, "bucket")
            or not storage_client.client
            or not storage_client.bucket
        ):
            print(
                "GCP Storage client not properly initialized, falling back to local storage"
            )
            local_client = LocalStorageClient()
            media_data = await local_client.upload_file(file, folder, current_user.id)
        else:
            media_data = await storage_client.upload_file(file, folder, current_user.id)
    except Exception as e:
        print(f"Exception during file upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {str(e)}",
        )

    if not media_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file to storage - no data returned from storage client",
        )

    if "error" in media_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=media_data["error"]
        )

    return {
        "url": media_data["url"],
        "filename": media_data["filename"],
        "media_type": media_data["media_type"],
        "size": media_data["size"],
    }

@router.delete("/media/{file_path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_file(
    file_path: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    storage_path = file_path

    user_messages = (
        db.query(models.Message)
        .filter(
            and_(
                models.Message.sender_id == current_user.id,
                models.Message.media_url.contains(storage_path),
            )
        )
        .all()
    )

    group_messages = (
        db.query(models.GroupMessage)
        .filter(
            and_(
                models.GroupMessage.sender_id == current_user.id,
                models.GroupMessage.media_url.contains(storage_path),
            )
        )
        .all()
    )

    if user_messages or group_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невозможно удалить файл, т.к. он используется в сообщениях",
        )

    if storage_client.delete_file(storage_path):
        return None
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении файла",
        )

# Deprecated endpoint (can be removed if not used elsewhere)
# @router.get("/messages", response_model=List[schemas.Message])
# async def get_messages(
#     db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
# ):
#     messages = (
#         db.query(models.Message)
#         .order_by(models.Message.timestamp.desc())
#         .limit(50)
#         .all()
#     )
#     return messages 