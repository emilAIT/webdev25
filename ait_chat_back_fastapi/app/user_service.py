import json
import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import or_, and_, desc

from . import models, schemas
from .database import get_db
from .auth import get_current_user, authenticate_user, get_password_hash # Import needed auth functions
# Need manager for broadcasting deletion. Where should it live?
# For now, assume it's passed or globally available (needs adjustment)
# from .chat_service import manager # This might create circular dependency

router = APIRouter()

@router.get("/users/search", response_model=List[schemas.User])
async def search_users(
    username: str = Query(
        ...,
        min_length=1,
        description="Text to search for in usernames or nicknames"
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Search for users by username or nickname (case-insensitive, partial match)."""
    if not username:
        return []

    search_pattern = f"%{username}%"

    users = (
        db.query(models.User)
        .filter(
            or_(
                models.User.username.ilike(search_pattern),
                models.User.nickname.ilike(search_pattern),
            ),
            models.User.id != current_user.id,
        )
        .limit(10)
        .all()
    )
    return users


@router.get("/contacts", response_model=List[schemas.User])
async def read_contacts(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    contacts = current_user.contacts
    contacts_with_details = []
    for contact in contacts:
        # Calculate unread count
        unread_count = (
            db.query(func.count(models.Message.id))
            .filter(
                and_(
                    models.Message.sender_id == contact.id,
                    models.Message.recipient_id == current_user.id,
                    models.Message.read_at.is_(None),
                )
            )
            .scalar()
            or 0
        )

        # Get the last message ORM object
        last_message_orm = (
            db.query(models.Message)
            .filter(
                or_(
                    and_(models.Message.sender_id == current_user.id, models.Message.recipient_id == contact.id),
                    and_(models.Message.sender_id == contact.id, models.Message.recipient_id == current_user.id)
                )
            )
            .order_by(desc(models.Message.timestamp))
            .first()
        )
        print(f"Last message: {last_message_orm}")
        # Convert last_message ORM to Pydantic schema (if exists)
        # Assuming Pydantic v2+, use model_validate
        last_message_schema = schemas.Message.model_validate(last_message_orm) 
        print(f"Last message schema: {last_message_schema}")
        # Manually create the User schema, including the calculated fields
        contact_schema = schemas.User(
            id=contact.id,
            username=contact.username,
            email=contact.email,
            is_active=contact.is_active,
            is_online=contact.is_online,
            last_seen=contact.last_seen,
            registered_at=contact.registered_at,
            description=contact.description,
            nickname=contact.nickname,
            unread_count=unread_count,         # Assign calculated unread_count
            last_message=last_message_schema  # Assign the converted last_message
        )

        contacts_with_details.append(contact_schema)
        # contacts_with_details.append(last_message_schema)
    print(f"Contacts with details: {contacts_with_details}")
    return contacts_with_details


@router.post("/contacts", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def add_contact(
    contact_data: schemas.ContactAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contact_username = contact_data.username.strip()

    if contact_username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a contact")

    contact_user = (
        db.query(models.User).filter(models.User.username == contact_username).first()
    )
    if not contact_user:
        raise HTTPException(
            status_code=404, detail=f"User '{contact_username}' not found"
        )

    existing_contact = (
        db.query(models.contacts_table)
        .filter(
            models.contacts_table.c.user_id == current_user.id,
            models.contacts_table.c.contact_id == contact_user.id,
        )
        .first()
    )

    if existing_contact:
        raise HTTPException(
            status_code=400, detail=f"'{contact_username}' is already in your contacts"
        )

    current_user.contacts.append(contact_user)
    db.add(current_user)
    db.commit()

    return schemas.User.from_orm(contact_user)

# --- User Profile Management API Endpoints ---

@router.patch("/users/me/username", response_model=schemas.User)
async def update_username(
    username_data: schemas.UsernameUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not username_data.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username cannot be empty"
        )

    existing_user = (
        db.query(models.User)
        .filter(
            models.User.username == username_data.username,
            models.User.id != current_user.id,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
        )

    current_user.username = username_data.username
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    # Broadcast username change
    # username_update_notification = {
    #     "action": "user_update",
    #     "payload": {
    #         "user_id": current_user.id,
    #         "update_type": "username",
    #         "old_value": current_user.username, # This shows the *new* username here, logic error
    #         "new_value": username_data.username,
    #     },
    # }
    # asyncio.create_task(manager.broadcast(json.dumps(username_update_notification))) # Manager dependency issue

    return current_user

@router.patch("/users/me/email", response_model=schemas.User)
async def update_email(
    email_data: schemas.EmailUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == email_data.email, models.User.id != current_user.id
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    current_user.email = email_data.email
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return current_user


@router.patch("/users/me/description", response_model=schemas.User)
async def update_description(
    description_data: schemas.DescriptionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.description = description_data.description
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    # Broadcast description update
    # description_update_notification = {
    #     "action": "user_update",
    #     "payload": {
    #         "user_id": current_user.id,
    #         "update_type": "description",
    #         "new_value": description_data.description,
    #     },
    # }
    # asyncio.create_task(manager.broadcast(json.dumps(description_update_notification))) # Manager dependency issue

    return current_user


@router.patch("/users/me/nickname", response_model=schemas.User)
async def update_nickname(
    nickname_data: schemas.NicknameUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if nickname_data.nickname:
        existing_nickname = (
            db.query(models.User)
            .filter(
                models.User.nickname == nickname_data.nickname,
                models.User.id != current_user.id,
            )
            .first()
        )

        if existing_nickname:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Nickname already taken"
            )

    current_user.nickname = nickname_data.nickname
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    # Broadcast nickname update
    # nickname_update_notification = {
    #     "action": "user_update",
    #     "payload": {
    #         "user_id": current_user.id,
    #         "update_type": "nickname",
    #         "new_value": nickname_data.nickname,
    #     },
    # }
    # asyncio.create_task(manager.broadcast(json.dumps(nickname_update_notification))) # Manager dependency issue

    return current_user


@router.patch("/users/me/password", status_code=status.HTTP_200_OK)
async def update_password(
    password_data: schemas.PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not authenticate_user(db, current_user.username, password_data.current_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )

    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.add(current_user)
    db.commit()

    tokens_revoked = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.user_id == current_user.id,
            models.RefreshToken.revoked == False,
        )
        .update({"revoked": True})
    )
    db.commit()

    return {
        "message": "Password updated successfully",
        "tokens_revoked": tokens_revoked,
    }


@router.get("/users/{user_id}/profile", response_model=schemas.User)
async def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )
    return user

@router.delete("/users/me", response_model=dict)
async def delete_my_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_id = current_user.id
    username = current_user.username

    # Disconnect WebSocket if connected
    # if user_id in manager.active_connections: # Manager dependency issue
    #     try:
    #         await manager.active_connections[user_id].close()
    #     except Exception as e:
    #         print(f"Error closing WebSocket for user {user_id}: {e}")

    # Remove from contacts
    db.query(models.contacts_table).filter(
        or_(
            models.contacts_table.c.user_id == user_id,
            models.contacts_table.c.contact_id == user_id,
        )
    ).delete(synchronize_session=False)

    # Remove from groups
    db.query(models.GroupMember).filter(models.GroupMember.member_id == user_id).delete(
        synchronize_session=False
    )

    # Delete messages
    db.query(models.Message).filter(models.Message.sender_id == user_id).delete(
        synchronize_session=False
    )
    db.query(models.Message).filter(models.Message.recipient_id == user_id).delete(
        synchronize_session=False
    )
    db.query(models.GroupMessage).filter(
        models.GroupMessage.sender_id == user_id
    ).delete(synchronize_session=False)

    # Delete refresh tokens
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user_id).delete(
        synchronize_session=False
    )

    # Delete user
    db.query(models.User).filter(models.User.id == user_id).delete()

    db.commit()

    # Broadcast deletion
    # deletion_notification = {
    #     "action": "user_deleted",
    #     "payload": {"user_id": user_id, "username": username},
    # }
    # asyncio.create_task(manager.broadcast(json.dumps(deletion_notification))) # Manager dependency issue

    return {
        "message": "Your account has been deleted successfully",
        "details": "All your messages and account information have been removed from the system",
    } 