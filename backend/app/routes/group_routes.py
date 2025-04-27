from fastapi import (
    APIRouter,
    Depends,
    Request,
    Body,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
)
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, not_
from typing import List, Optional
from pathlib import Path
import datetime
import json

from ..database.database import get_db
from ..models.models import User, Group, Message
from ..services.auth import get_current_user

# Create router for group routes
router = APIRouter()


@router.post("/create")
async def create_group(
    request: Request,
    group_name: str = Body(..., embed=True),
    description: str = Body(default="", embed=True),
    avatar: str = Body(default="/static/images/group-meow-avatar.png", embed=True),
    member_ids: List[int] = Body(default=[], embed=True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new group chat"""
    if not current_user:
        return {"error": "Unauthorized"}

    # Create new group
    new_group = Group(
        name=group_name,
        description=description,
        created_by=current_user.id,
        avatar=avatar,
    )

    # Add creator to the group
    new_group.members.append(current_user)

    # Add other members
    for member_id in member_ids:
        member = db.query(User).filter(User.id == member_id).first()
        if member:
            new_group.members.append(member)

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return {
        "group_id": new_group.id,
        "name": new_group.name,
        "avatar": new_group.avatar,
        "description": new_group.description,
    }


@router.post("/add-member")
async def add_to_group(
    request: Request,
    group_id: int = Body(..., embed=True),
    user_id: int = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Add a user to a group"""
    if not current_user:
        return {"error": "Unauthorized"}

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        return {"error": "Group not found"}

    # Check if current user is in the group
    if current_user not in group.members:
        return {"error": "You are not a member of this group"}

    # Add user to group
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "User not found"}

    if user in group.members:
        return {"error": "User already in group"}

    group.members.append(user)
    db.commit()

    return {"success": True}


@router.get("/{group_id}/messages")
async def get_group_messages(
    group_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Get all messages in a group"""
    if not current_user:
        return {"error": "Unauthorized"}

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        return {"error": "Group not found"}

    # Verify user is part of this group
    if current_user not in group.members:
        return {"error": "Unauthorized"}

    messages = (
        db.query(Message)
        .filter(Message.group_id == group_id)
        .order_by(Message.timestamp)
        .all()
    )

    message_list = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        message_list.append(
            {
                "id": msg.id,
                "sender": {
                    "id": sender.id,
                    "username": sender.username,
                    "avatar": sender.avatar,
                },
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "edited": msg.edited,  # Include edited flag
                "edited_at": (
                    msg.edited_at.isoformat() if msg.edited_at else None
                ),  # Include edited timestamp
            }
        )

    return {"messages": message_list}


@router.post("/{group_id}/messages")
async def send_group_message(
    group_id: int,
    content: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Send a message in a group chat"""
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

    # Create new message
    new_message = Message(
        content=content.get("content"),
        sender_id=current_user.id,
        group_id=group_id,
        timestamp=datetime.datetime.now(),
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return {"success": True, "message_id": new_message.id}


@router.put("/{group_id}/messages/{message_id}")
async def update_group_message(
    group_id: int,
    message_id: int,
    content: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update a message in a group chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is a member of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    # Find the message
    message = (
        db.query(Message)
        .filter(Message.id == message_id, Message.group_id == group_id)
        .first()
    )
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
    message.edited_at = datetime.datetime.now()

    # Save changes
    db.commit()

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


@router.delete("/{group_id}/messages/clear")
async def clear_group_messages(
    group_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Clear all messages in a group chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if the group exists
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is a member of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    try:
        # Delete all messages in the group
        num_deleted = db.query(Message).filter(Message.group_id == group_id).delete()

        db.commit()

        # Send WebSocket notification to all group members using the dedicated method
        try:
            from ..websockets.connection_manager import manager

            await manager.broadcast_group_cleared(group_id, current_user.id, db)

            print(
                f"WebSocket notification sent for group chat clear in group {group_id}"
            )
        except Exception as e:
            print(
                f"Error sending WebSocket notification for group chat clear: {str(e)}"
            )

        return {
            "success": True,
            "message": f"Successfully cleared {num_deleted} messages from group chat",
        }
    except Exception as e:
        db.rollback()
        print(f"Error clearing messages in group {group_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database error while clearing messages: {str(e)}"
        )


@router.delete("/{group_id}/messages/{message_id}")
async def delete_group_message(
    group_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete a message from a group chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is a member of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    # Find the message
    message = (
        db.query(Message)
        .filter(Message.id == message_id, Message.group_id == group_id)
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Verify user is the sender of this message
    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You can only delete your own messages"
        )

    # Delete the message
    db.delete(message)
    db.commit()

    # Send WebSocket notification about deleted message
    try:
        # Create WebSocket notification data
        ws_data = {
            "type": "message_deleted",
            "message_id": message_id,
            "group_id": group_id,
            "deleted_by": current_user.id,
            "timestamp": datetime.datetime.now().isoformat(),
        }

        # Import and use the connection manager
        from ..websockets.connection_manager import manager

        # Broadcast to all group members
        await manager.broadcast_to_group(ws_data, group_id, db)

        print(f"WebSocket notification sent for deleted message to group {group_id}")
    except Exception as e:
        print(f"Error sending WebSocket notification for deleted message: {str(e)}")
        # We don't fail the request if WebSocket notification fails

    return {"success": True, "message": "Message deleted successfully"}


@router.get("/{group_id}/members")
async def get_group_members(
    group_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Get all members of a group"""
    if not current_user:
        return {"error": "Unauthorized"}

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        return {"error": "Group not found"}

    # Verify user is part of this group
    if current_user not in group.members:
        return {"error": "Unauthorized"}

    member_list = []
    for member in group.members:
        member_list.append(
            {"id": member.id, "username": member.username, "avatar": member.avatar}
        )

    return {"members": member_list}


@router.get("/{group_id}/details")
async def get_group_details(
    group_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Get detailed information about a group, including members."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is part of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    member_list = []
    for member in group.members:
        # Определяем статус онлайн (аналогично /api/chat/user-status/{user_id})
        now = datetime.datetime.utcnow()
        is_online = False
        last_seen_iso = None
        if member.last_seen:
            last_seen_iso = member.last_seen.isoformat()
            if (now - member.last_seen) < datetime.timedelta(minutes=1):
                is_online = True

        member_list.append(
            {
                "id": member.id,
                "username": member.username,
                "avatar": member.avatar,  # Используем поле avatar, которое уже есть
                "last_seen": last_seen_iso,
                "is_online": is_online,
            }
        )

    return {
        "id": group.id,
        "name": group.name,
        "avatar": group.avatar,
        "description": group.description,
        "created_by": group.created_by,  # ID создателя группы
        "participant_count": len(group.members),
        "members": member_list,
    }


@router.post("/create-with-avatar")
async def create_group_with_avatar(
    request: Request,
    group_name: str = Form(...),
    description: str = Form(default=""),
    member_ids: str = Form(...),  # Получаем ID как строку JSON
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new group chat with an avatar"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # --- Логика сохранения файла аватара (аналогично /api/chat/avatar) ---
    avatar_relative_path = None
    try:
        # Проверяем формат файла
        content_type = avatar.content_type
        if not content_type or not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail="Загружаемый файл должен быть изображением"
            )

        # Создаем директорию для аватаров групп
        avatar_dir = Path("../frontend/static/images/group_avatars")
        avatar_dir.mkdir(exist_ok=True, parents=True)

        # Генерируем уникальное имя файла
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
        filename = f"group_{current_user.id}_{timestamp}"
        # Используем безопасное расширение из content_type
        extension = content_type.split("/")[-1]
        if extension == "jpeg":
            extension = "jpg"  # Нормализуем jpeg в jpg
        if extension not in ["jpg", "png", "gif", "webp"]:
            raise HTTPException(
                status_code=400, detail="Неподдерживаемый формат изображения"
            )

        file_path = avatar_dir / f"{filename}.{extension}"
        avatar_relative_path = f"/static/images/group_avatars/{filename}.{extension}"

        # Сохраняем файл
        contents = await avatar.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        print(f"Group avatar saved to: {file_path}")

    except Exception as e:
        print(f"Error uploading group avatar: {str(e)}")
        # Если ошибка загрузки аватара, можно продолжить без него или вернуть ошибку
        # В данном случае, просто не будем использовать аватар
        avatar_relative_path = None  # Сбрасываем путь, если была ошибка
        # Можно добавить HTTPException, если аватар обязателен
        # raise HTTPException(status_code=500, detail=f"Ошибка при загрузке аватара: {str(e)}")
    # --- Конец логики сохранения файла ---

    # Парсим ID участников из строки JSON
    try:
        member_id_list = json.loads(member_ids)
        if not isinstance(member_id_list, list):
            raise ValueError("member_ids должен быть списком")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=400, detail=f"Некорректный формат member_ids: {str(e)}"
        )

    # Создаем новую группу
    new_group = Group(
        name=group_name,
        description=description,
        created_by=current_user.id,
        avatar=avatar_relative_path or "/static/images/group-meow-avatar.png",
    )

    # Добавляем создателя
    new_group.members.append(current_user)

    # Добавляем других участников
    if member_id_list:
        members = db.query(User).filter(User.id.in_(member_id_list)).all()
        for member in members:
            if member.id != current_user.id:  # Не добавляем создателя дважды
                new_group.members.append(member)

    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    print(
        f"Group created: {new_group.id}, Name: {new_group.name}, Avatar: {new_group.avatar}"
    )

    # Возвращаем данные о созданной группе
    return {
        "success": True,
        "group_id": new_group.id,
        "name": new_group.name,
        "avatar": new_group.avatar,
        "description": new_group.description,
        "members": [m.id for m in new_group.members],  # Возвращаем ID участников
    }


# --- Добавлено: Эндпоинт для обновления информации о группе ---
@router.put("/{group_id}/update")
async def update_group_details(
    group_id: int,
    group_name: str = Form(None),  # Опционально, если не передано, не меняем
    description: str = Form(None),  # Опционально
    avatar: UploadFile = File(None),  # Опционально
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update group details (name, description, avatar)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is part of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    updated = False

    # Обновляем имя, если оно передано
    if group_name is not None and group_name.strip() != group.name:
        group.name = group_name.strip()
        updated = True
        print(f"Updating group {group_id} name to: {group.name}")

    # Обновляем описание, если оно передано
    if description is not None and description.strip() != group.description:
        group.description = description.strip()
        updated = True
        print(f"Updating group {group_id} description to: {group.description}")

    # Обновляем аватар, если он передан
    if avatar is not None:
        # --- Логика сохранения файла аватара (аналогично create_group_with_avatar) ---
        avatar_relative_path = None
        try:
            content_type = avatar.content_type
            if not content_type or not content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400, detail="Uploaded file must be an image"
                )

            avatar_dir = Path("../frontend/static/images/group_avatars")
            avatar_dir.mkdir(exist_ok=True, parents=True)

            timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
            filename = f"group_{group_id}_updated_{timestamp}"  # Добавим group_id в имя
            extension = content_type.split("/")[-1]
            if extension == "jpeg":
                extension = "jpg"
            if extension not in ["jpg", "png", "gif", "webp"]:
                raise HTTPException(status_code=400, detail="Unsupported image format")

            file_path = avatar_dir / f"{filename}.{extension}"
            avatar_relative_path = (
                f"/static/images/group_avatars/{filename}.{extension}"
            )

            contents = await avatar.read()
            with open(file_path, "wb") as f:
                f.write(contents)
            print(f"Group {group_id} new avatar saved to: {file_path}")

            # TODO: Удалить старый файл аватара, если он был и не дефолтный
            # if group.avatar and group.avatar != "/static/images/group-meow-avatar.png":
            #     try:
            #         old_avatar_path = Path("../frontend") / group.avatar.lstrip('/')
            #         old_avatar_path.unlink(missing_ok=True)
            #         print(f"Deleted old avatar: {old_avatar_path}")
            #     except Exception as delete_error:
            #         print(f"Error deleting old avatar {group.avatar}: {delete_error}")

            group.avatar = avatar_relative_path
            updated = True

        except Exception as e:
            print(f"Error uploading new group avatar for group {group_id}: {str(e)}")
            # Не прерываем процесс, если аватар не загрузился, просто не обновляем его
            # Можно вернуть ошибку, если загрузка аватара критична
            # raise HTTPException(status_code=500, detail=f"Error uploading avatar: {str(e)}")
        # --- Конец логики сохранения файла ---

    if updated:
        db.commit()
        db.refresh(group)
        print(f"Group {group_id} updated successfully.")
        # Возвращаем обновленные детали (аналогично /details)
        members = [
            {"id": m.id, "username": m.username, "avatar": m.avatar}
            for m in group.members
        ]
        return {
            "success": True,
            "id": group.id,
            "name": group.name,
            "avatar": group.avatar,
            "description": group.description,
            "participant_count": len(group.members),
            "members": members,  # Вернем базовую инфу об участниках для обновления UI
        }
    else:
        # Если ничего не было передано для обновления
        raise HTTPException(status_code=400, detail="No data provided for update")


# --- Добавлено: Эндпоинт для поиска пользователей для добавления в группу ---
@router.get("/{group_id}/search-potential-members")
async def search_potential_members(
    group_id: int,
    query: str = Query(None, min_length=1),  # Используем Query для параметра запроса
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search for users who are not already in the specified group."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not query:
        return []  # Возвращаем пустой список, если запрос пустой

    group = (
        db.query(Group)
        .options(joinedload(Group.members))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Убедимся, что текущий пользователь - участник группы (для права поиска)
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    # Получаем ID текущих участников группы
    current_member_ids = {member.id for member in group.members}

    # Ищем пользователей по имени (username), исключая текущих участников
    # И исключая самого себя, если это не создатель группы (хотя он и так будет в current_member_ids)
    search = f"%{query}%"
    potential_members = (
        db.query(User)
        .filter(User.username.ilike(search), not_(User.id.in_(current_member_ids)))
        .limit(10)  # Ограничиваем количество результатов
        .all()
    )

    # Форматируем результат
    result_list = [
        {
            "id": user.id,
            "username": user.username,
            "avatar_url": user.avatar,  # Используем avatar как URL
        }
        for user in potential_members
    ]

    return result_list


@router.post("/{group_id}/leave")
async def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a group chat"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is a member of this group
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="You are not a member of this group"
        )

    # Check if this user is the only member left
    if len(group.members) <= 1:
        # If the user is the only member, delete the group
        db.delete(group)
        db.commit()
        return {
            "success": True,
            "message": "Group was deleted as you were the last member",
        }

    # Check if this user is the creator and transfer ownership if needed
    if group.created_by == current_user.id and len(group.members) > 1:
        # Find another member to transfer ownership to
        new_owner = None
        for member in group.members:
            if member.id != current_user.id:
                new_owner = member
                break

        if new_owner:
            group.created_by = new_owner.id
            print(
                f"Group {group_id} ownership transferred from user {current_user.id} to user {new_owner.id}"
            )

    # Store username before removing from group (for notification)
    username = current_user.username

    # Remove the user from the group
    group.members.remove(current_user)
    db.commit()

    # Send WebSocket notification to all remaining group members
    try:
        from ..websockets.connection_manager import manager

        # Use the dedicated method to send notification
        await manager.broadcast_user_left_group(group_id, current_user.id, username, db)
        print(
            f"WebSocket notification sent for user {current_user.id} leaving group {group_id}"
        )
    except Exception as e:
        print(f"Error sending WebSocket notification for leaving group: {str(e)}")
        # We don't fail the request if WebSocket notification fails

    return {"success": True, "message": "Successfully left the group"}


# --- Добавлено: Эндпоинт для добавления нескольких участников в группу ---
@router.post("/{group_id}/add-members")
async def add_members_to_group(
    group_id: int,
    user_ids: List[int] = Body(
        ..., embed=True, alias="user_ids"
    ),  # Ожидаем список ID в теле запроса
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add multiple users to a group."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    group = (
        db.query(Group)
        .options(joinedload(Group.members))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Проверка: может ли текущий пользователь добавлять участников?
    # Пока разрешаем всем участникам группы.
    if current_user not in group.members:
        raise HTTPException(
            status_code=403, detail="Only group members can add new members"
        )

    if not user_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided")

    # Получаем ID существующих участников
    current_member_ids = {member.id for member in group.members}

    # Фильтруем ID, чтобы добавлять только новых
    ids_to_actually_add = [uid for uid in user_ids if uid not in current_member_ids]

    if not ids_to_actually_add:
        # Если все предложенные пользователи уже в группе
        return {"success": True, "message": "All specified users are already members."}
        # Или можно вернуть ошибку 400, в зависимости от желаемого поведения
        # raise HTTPException(status_code=400, detail="All specified users are already members.")

    # Находим пользователей для добавления
    users_to_add = db.query(User).filter(User.id.in_(ids_to_actually_add)).all()

    # Проверяем, все ли найдены (на случай некорректных ID в запросе)
    found_user_ids = {user.id for user in users_to_add}
    missing_ids = set(ids_to_actually_add) - found_user_ids
    if missing_ids:
        print(f"Warning: Users not found for IDs: {missing_ids}")
        # Можно вернуть ошибку или просто проигнорировать отсутствующих

    # Добавляем найденных пользователей
    added_count = 0
    for user in users_to_add:
        # Дополнительная проверка на всякий случай (хотя фильтр выше должен был сработать)
        if user not in group.members:
            group.members.append(user)
            added_count += 1

    if added_count > 0:
        try:
            db.commit()
            print(f"Added {added_count} new members to group {group_id}")
        except Exception as e:
            db.rollback()
            print(f"Error adding members to group {group_id}: {e}")
            raise HTTPException(
                status_code=500, detail="Database error while adding members."
            )

        # Можно вернуть обновленный список участников, если нужно
        return {
            "success": True,
            "message": f"Successfully added {added_count} members.",
        }
    else:
        # Сюда мы можем попасть, если пользователи были добавлены конкурентно
        return {
            "success": True,
            "message": "No new members were added (they might already be members).",
        }


# --- Конец добавленных эндпоинтов ---
