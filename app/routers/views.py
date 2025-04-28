from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

# Updated imports to use the new location and updated models
from app.routers.session import (
    get_db,
    get_current_user,
    active_connections,
    id_to_username,
)
from app.database import User, Room, Message, GroupChat, room_members

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/api/user/{user_id}/status")
async def get_user_status(user_id: int, db: Session = Depends(get_db)):
    """Get user's online status"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if user is in active_connections dictionary or in id_to_username mapping
    is_online = (
        user.username in active_connections
        and len(active_connections[user.username]) > 0
    ) or user.is_online

    return {
        "user_id": user_id,
        "username": user.username,
        "status": "online" if is_online else "offline",
    }


@router.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request, db: Session = Depends(get_db)):
    """Render the main chat page with user's rooms (direct and group chats)"""
    try:
        username = get_current_user(request)
    except HTTPException:
        return RedirectResponse("/login", status_code=status.HTTP_303_SEE_OTHER)

    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        return RedirectResponse("/login", status_code=status.HTTP_303_SEE_OTHER)

    # Get all rooms where user is a member
    rooms_query = (
        db.query(Room)
        .join(room_members, Room.id == room_members.c.room_id)
        .filter(room_members.c.user_id == current_user.id)
    )

    rooms_list = []

    for room in rooms_query.all():
        # For direct chats, get the other user
        if not room.is_group:
            # Find the other user in the room
            other_member = (
                db.query(User)
                .join(room_members, User.id == room_members.c.user_id)
                .filter(
                    and_(room_members.c.room_id == room.id, User.id != current_user.id)
                )
                .first()
            )

            if other_member:
                # Check if other user is online
                connection_status = (
                    "online"
                    if other_member.username in active_connections
                    else "offline"
                )

                # Get last message in room if any
                last_message = (
                    db.query(Message)
                    .filter(Message.room_id == room.id)
                    .order_by(Message.timestamp.desc())
                    .first()
                )

                # Count unread messages
                unread_count = (
                    db.query(Message)
                    .filter(
                        Message.room_id == room.id,
                        Message.sender_id != current_user.id,
                        Message.read == False,
                    )
                    .count()
                )

                room_data = {
                    "id": room.id,
                    "user_id": other_member.id,
                    "name": other_member.full_name or other_member.username,
                    "username": other_member.username,
                    "email": other_member.email,
                    "avatar": other_member.avatar or "/static/images/profile_photo.jpg",
                    "status": connection_status,
                    "is_group": False,
                    "last_message": (
                        last_message.content
                        if last_message
                        else "Click to start chatting!"
                    ),
                    "last_message_time": (
                        last_message.timestamp.strftime("%H:%M")
                        if last_message
                        else "Now"
                    ),
                    "unread_count": unread_count,
                }
                rooms_list.append(room_data)
        else:
            # For group chats, get the group data
            group_chat = db.query(GroupChat).filter(GroupChat.id == room.id).first()

            if group_chat:
                # Count members
                member_count = (
                    db.query(room_members)
                    .filter(room_members.c.room_id == room.id)
                    .count()
                )

                # Get last message in group if any
                last_message = (
                    db.query(Message)
                    .filter(Message.room_id == room.id)
                    .order_by(Message.timestamp.desc())
                    .first()
                )

                # Count unread messages
                unread_count = (
                    db.query(Message)
                    .filter(
                        Message.room_id == room.id,
                        Message.sender_id != current_user.id,
                        Message.read == False,
                    )
                    .count()
                )

                room_data = {
                    "id": room.id,
                    "name": room.name,
                    "avatar": group_chat.avatar or "/static/images/profile_photo.jpg",
                    "is_group": True,
                    "description": group_chat.description,
                    "member_count": member_count,
                    "last_message": (
                        last_message.content
                        if last_message
                        else "Start to chat together!"
                    ),
                    "last_message_time": (
                        last_message.timestamp.strftime("%H:%M")
                        if last_message
                        else "Now"
                    ),
                    "unread_count": unread_count,
                }
                rooms_list.append(room_data)

    return templates.TemplateResponse(
        "chat.html", {"request": request, "username": username, "rooms": rooms_list}
    )
