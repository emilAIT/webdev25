from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from sqlalchemy.sql import text
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.routers.session import get_db, get_current_user
from app.database import User, Room, Message, room_members, GroupChat
from app.routers.websockets import (
    notify_new_room,
)  # Import the new notification function


# Add Pydantic model for request validation
class DirectMessageRequest(BaseModel):
    username_to_add: str


class UpdateMessageRequest(BaseModel):
    content: str


router = APIRouter(prefix="/api")


# Get all rooms for current user
@router.get("/rooms")
async def get_rooms(
    username: str = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all chat rooms for the current user"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Get all rooms where the user is a member
    rooms = (
        db.query(Room)
        .join(room_members, Room.id == room_members.c.room_id)
        .filter(room_members.c.user_id == current_user.id)
        .all()
    )

    result = []
    for room in rooms:
        # Get latest message in the room
        latest_message = (
            db.query(Message)
            .filter(Message.room_id == room.id)
            .order_by(desc(Message.timestamp))
            .first()
        )

        # For group chats
        if room.is_group:
            # Get group info
            group_chat = (
                db.query(func.count(room_members.c.user_id).label("member_count"))
                .filter(room_members.c.room_id == room.id)
                .scalar()
            )

            # Count unread messages
            unread_count = (
                db.query(func.count(Message.id))
                .filter(
                    and_(
                        Message.room_id == room.id,
                        Message.sender_id != current_user.id,
                        Message.read == False,
                    )
                )
                .scalar()
            )

            # Get group info for avatar
            group_info = db.query(GroupChat).filter(GroupChat.id == room.id).first()

            result.append(
                {
                    "id": room.id,
                    "name": room.name,
                    "is_group": True,
                    "avatar": (
                        group_info.avatar
                        if group_info
                        else "/static/images/profile_photo.jpg"
                    ),
                    "description": group_info.description if group_info else "",
                    "member_count": group_chat,
                    "last_message": (
                        latest_message.content
                        if latest_message
                        else "Group created. Click to start chatting!"
                    ),
                    "last_message_time": (
                        latest_message.timestamp.strftime("%H:%M")
                        if latest_message
                        else "Now"
                    ),
                    "unread_count": unread_count,
                }
            )
        # For direct chats
        else:
            # Get the other user in the room
            other_user = (
                db.query(User)
                .join(room_members, User.id == room_members.c.user_id)
                .filter(
                    and_(room_members.c.room_id == room.id, User.id != current_user.id)
                )
                .first()
            )

            # If no other user found, this might be a self-chat
            if not other_user:
                other_user = current_user

            # Count unread messages
            unread_count = (
                db.query(func.count(Message.id))
                .filter(
                    and_(
                        Message.room_id == room.id,
                        Message.sender_id != current_user.id,
                        Message.read == False,
                    )
                )
                .scalar()
            )

            # Craft room name from other user's info
            room_name = other_user.full_name or other_user.username

            result.append(
                {
                    "id": room.id,
                    "name": room_name,
                    "username": other_user.username,
                    "avatar": other_user.avatar or "/static/images/profile_photo.jpg",
                    "user_id": other_user.id,
                    "is_group": False,
                    "last_message": (
                        latest_message.content
                        if latest_message
                        else "Click to start chatting!"
                    ),
                    "last_message_time": (
                        latest_message.timestamp.strftime("%H:%M")
                        if latest_message
                        else "Now"
                    ),
                    "unread_count": unread_count,
                    "status": "online" if other_user.is_online else "offline",
                }
            )

    # Sort by latest message time
    result.sort(
        key=lambda x: x.get("last_message_time", "1900-01-01") or "1900-01-01",
        reverse=True,
    )

    return result


# Create a direct message room with another user by username
@router.post("/rooms/direct")
async def create_direct_room_by_username(
    request_data: DirectMessageRequest,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a direct message room with another user by username"""
    print(
        "[DEBUG] Received request to add friend with username:",
        request_data.username_to_add,
    )

    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        print("[ERROR] Current user not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    username_to_add = request_data.username_to_add
    if not username_to_add:
        print("[ERROR] Username to add is missing")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username to add is required",
        )

    # Get target user
    target_user = db.query(User).filter(User.username == username_to_add).first()
    if not target_user:
        print("[ERROR] Target user not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Can't add self
    if current_user.id == target_user.id:
        print("[ERROR] Cannot create chat with yourself")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create chat with yourself",
        )

    # Check if a direct room already exists between these users
    existing_room = (
        db.query(Room)
        .filter(Room.is_group == False)
        .filter(
            Room.id.in_(
                db.query(room_members.c.room_id)
                .filter(room_members.c.user_id == current_user.id)
                .intersect(
                    db.query(room_members.c.room_id).filter(
                        room_members.c.user_id == target_user.id
                    )
                )
            )
        )
        .first()
    )

    if existing_room:
        print("[DEBUG] Existing room found:", existing_room.id)
        return {
            "id": existing_room.id,
            "name": target_user.full_name or target_user.username,
            "username": target_user.username,
            "avatar": target_user.avatar,
            "is_group": False,
        }

    # Create new direct message room
    print("[DEBUG] Creating new direct message room")
    new_room = Room(
        name=f"DM: {current_user.username} - {target_user.username}",  # Internal name
        is_group=False,
        created_at=datetime.utcnow(),
    )
    db.add(new_room)
    db.flush()  # Get ID of new room

    # Add both users to the room
    from sqlalchemy import insert

    db.execute(
        insert(room_members).values(
            room_id=new_room.id, user_id=current_user.id, joined_at=datetime.utcnow()
        )
    )
    db.execute(
        insert(room_members).values(
            room_id=new_room.id, user_id=target_user.id, joined_at=datetime.utcnow()
        )
    )

    db.commit()

    # Notify the target user about the new room
    print("[DEBUG] Notifying target user about the new room")
    await notify_new_room(new_room.id, target_user.id, current_user, db)

    print("[DEBUG] Direct message room created successfully")
    return {
        "id": new_room.id,
        "name": target_user.full_name or target_user.username,
        "username": target_user.username,
        "avatar": target_user.avatar,
        "is_group": False,
    }


# Get messages from a specific room
@router.get("/messages/{room_id}")
async def get_room_messages(
    room_id: int,
    before_id: Optional[int] = None,
    limit: int = 20,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get messages from a specific room with pagination"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Check if user is a member of this room
    is_member = (
        db.query(room_members)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == current_user.id,
            )
        )
        .first()
        is not None
    )

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room",
        )

    # Get messages with pagination
    query = db.query(Message).filter(Message.room_id == room_id)

    if before_id:
        query = query.filter(Message.id < before_id)

    messages = query.order_by(desc(Message.timestamp)).limit(limit).all()

    # Format messages
    result = []
    for message in reversed(messages):  # Reverse to get chronological order
        sender = db.query(User).filter(User.id == message.sender_id).first()

        result.append(
            {
                "id": message.id,
                "content": message.content,
                "sender_id": message.sender_id,
                "sender": (
                    "user"
                    if message.sender_id == current_user.id
                    else sender.username if sender else "unknown"
                ),
                "sender_name": (
                    sender.full_name or sender.username if sender else "Unknown"
                ),
                "timestamp": message.timestamp.isoformat(),
                "time": message.timestamp.strftime("%H:%M"),
                "delivered": message.delivered,
                "read": message.read,
            }
        )

    # Mark unread messages as read
    unread_messages = (
        db.query(Message)
        .filter(
            and_(
                Message.room_id == room_id,
                Message.sender_id != current_user.id,
                Message.read == False,
            )
        )
        .all()
    )

    # Group unread messages by sender for WebSocket notifications
    sender_to_messages = {}
    for msg in unread_messages:
        msg.read = True
        msg.read_at = datetime.utcnow()

        if msg.sender_id not in sender_to_messages:
            sender_to_messages[msg.sender_id] = []
        sender_to_messages[msg.sender_id].append(msg.id)

    db.commit()

    # Send WebSocket notifications to senders
    from app.routers.session import active_connections

    for sender_id, message_ids in sender_to_messages.items():
        sender = db.query(User).filter(User.id == sender_id).first()
        if sender and sender.username in active_connections:
            for sender_ws in active_connections[sender.username]:
                try:
                    await sender_ws.send_json(
                        {
                            "type": "message_read",
                            "room_id": room_id,
                            "reader_id": current_user.id,
                            "reader": current_user.username,
                            "message_ids": message_ids,
                        }
                    )
                except Exception as e:
                    print(f"Error sending read notification to {sender.username}: {e}")

    return result


# Edit a message
@router.post("/messages/{message_id}/edit")
async def update_message(
    message_id: int,
    request: UpdateMessageRequest,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit an existing message"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Get the message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )

    # Check if user is the sender of the message
    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own messages",
        )

    # Check if message is too old (older than 5 minutes)
    time_diff = (datetime.utcnow() - message.timestamp).total_seconds() / 60
    if time_diff > 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Messages can only be edited within 5 minutes of sending",
        )

    # Update message
    new_content = request.content.strip()
    if not new_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty",
        )

    # Store old content for reference
    old_content = message.content

    # Update message
    message.content = new_content
    message.edited = True
    message.edited_at = datetime.utcnow()
    db.commit()

    # Broadcast the edit to other users in the room
    from app.routers.session import active_connections

    room_members_query = (
        db.query(User.username)
        .join(room_members, User.id == room_members.c.user_id)
        .filter(
            and_(
                room_members.c.room_id == message.room_id,
                User.username != username,  # Don't send to the user who made the edit
            )
        )
        .all()
    )

    room_member_usernames = [member[0] for member in room_members_query]

    for member_username in room_member_usernames:
        if member_username in active_connections:
            for ws in active_connections[member_username]:
                try:
                    await ws.send_json(
                        {
                            "type": "message_updated",
                            "message_id": message.id,
                            "room_id": message.room_id,
                            "content": new_content,
                            "edited": True,
                            "edited_at": message.edited_at.isoformat(),
                        }
                    )
                except Exception as e:
                    print(f"Error sending message_updated notification: {e}")

    return {
        "id": message.id,
        "content": message.content,
        "edited": message.edited,
        "edited_at": message.edited_at.isoformat(),
    }


# Delete a message
@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a message"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Get the message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )

    # Check if user is the sender of the message or an admin in a group chat
    is_sender = message.sender_id == current_user.id
    is_admin = False

    # Check if this is a group chat and if the user is an admin
    room = db.query(Room).filter(Room.id == message.room_id).first()
    if room and room.is_group:
        is_admin = (
            db.query(room_members)
            .filter(
                and_(
                    room_members.c.room_id == message.room_id,
                    room_members.c.user_id == current_user.id,
                    room_members.c.is_admin == True,
                )
            )
            .first()
            is not None
        )

    if not (is_sender or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages or any message if you're a group admin",
        )

    # Store room ID for notifications
    room_id = message.room_id

    # Delete the message
    db.delete(message)
    db.commit()

    # Broadcast the deletion to other users in the room
    from app.routers.session import active_connections

    room_members_query = (
        db.query(User.username)
        .join(room_members, User.id == room_members.c.user_id)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                User.username
                != username,  # Don't send to the user who deleted the message
            )
        )
        .all()
    )

    room_member_usernames = [member[0] for member in room_members_query]

    for member_username in room_member_usernames:
        if member_username in active_connections:
            for ws in active_connections[member_username]:
                try:
                    await ws.send_json(
                        {
                            "type": "message_deleted",
                            "message_id": message_id,
                            "room_id": room_id,
                            "deleted_by": username,
                        }
                    )
                except Exception as e:
                    print(f"Error sending message_deleted notification: {e}")

    return {"success": True, "id": message_id}


# Clear all messages from a room (direct chat or group)
@router.delete("/rooms/{room_id}/messages")
async def clear_chat(
    room_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear all messages from a room (direct chat or group)"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Check if user is a member of this room
    is_member = (
        db.query(room_members)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == current_user.id,
            )
        )
        .first()
        is not None
    )

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room",
        )

    # For groups, only admins can clear chat
    if room.is_group:
        is_admin = (
            db.query(room_members)
            .filter(
                and_(
                    room_members.c.room_id == room_id,
                    room_members.c.user_id == current_user.id,
                    room_members.c.is_admin == True,
                )
            )
            .first()
            is not None
        )

        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can clear messages in group chats",
            )

    # Delete all messages from this room
    deleted_count = db.query(Message).filter(Message.room_id == room_id).delete()

    db.commit()

    # Broadcast to all members of the room that the chat was cleared
    # Get all members of the room
    members = (
        db.query(User)
        .join(room_members, User.id == room_members.c.user_id)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                User.id
                != current_user.id,  # Don't notify the user who cleared the chat
            )
        )
        .all()
    )

    # Send a websocket notification to all online members
    from app.routers.session import active_connections

    for member in members:
        if member.username in active_connections:
            for ws in active_connections[member.username]:
                try:
                    await ws.send_json(
                        {
                            "type": "chat_cleared",
                            "room_id": room_id,
                            "cleared_by": current_user.username,
                            "cleared_at": datetime.utcnow().isoformat(),
                        }
                    )
                except Exception as e:
                    print(f"Error sending chat_cleared notification: {e}")

    return {
        "status": "success",
        "message": f"Chat cleared successfully. {deleted_count} messages deleted.",
    }


# Delete a chat room (direct or group)
@router.delete("/rooms/{room_id}")
async def delete_room(
    room_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a chat room (direct or group)"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Check if user is a member of this room
    is_member = (
        db.query(room_members)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == current_user.id,
            )
        )
        .first()
        is not None
    )

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room",
        )

    # For groups, only admins can delete chat rooms
    if room.is_group:
        is_admin = (
            db.query(room_members)
            .filter(
                and_(
                    room_members.c.room_id == room_id,
                    room_members.c.user_id == current_user.id,
                    room_members.c.is_admin == True,
                )
            )
            .first()
            is not None
        )

        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can delete group chats",
            )

    # First get the other users in the chat for notification purposes
    other_users = []
    if not room.is_group:
        # For direct chats, just find the other user
        other_user = (
            db.query(User)
            .join(room_members, User.id == room_members.c.user_id)
            .filter(and_(room_members.c.room_id == room_id, User.id != current_user.id))
            .first()
        )
        if other_user:
            other_users = [other_user]
    else:
        # For group chats, get all other members
        other_users = (
            db.query(User)
            .join(room_members, User.id == room_members.c.user_id)
            .filter(
                and_(
                    room_members.c.room_id == room_id,
                    User.id != current_user.id,
                )
            )
            .all()
        )

    # Use the utility function to delete the room completely
    from app.routers.utils import delete_room_completely

    success = await delete_room_completely(room_id, db)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete the room",
        )

    # Notify other users about the deletion
    from app.routers.session import active_connections

    for other_user in other_users:
        if other_user.username in active_connections:
            for ws in active_connections[other_user.username]:
                try:
                    notification_type = (
                        "group_deleted" if room.is_group else "chat_deleted"
                    )
                    await ws.send_json(
                        {
                            "type": notification_type,
                            "room_id": room_id,
                            "deleted_by": current_user.username,
                        }
                    )
                except Exception as e:
                    print(f"Error sending deletion notification: {e}")

    return {"success": True, "message": "Chat deleted successfully"}


# Search for users
@router.get("/users/search")
async def search_users(
    query: str, username: str = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Search for users by username or full name"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Search for users
    search_pattern = f"%{query}%"
    users = (
        db.query(User)
        .filter(
            and_(
                or_(
                    User.username.ilike(search_pattern),
                    User.full_name.ilike(search_pattern),
                ),
                User.id != current_user.id,  # Exclude current user
            )
        )
        .limit(10)
        .all()
    )

    result = []
    for user in users:
        # Check if direct chat room exists with this user
        # Using aliases to avoid ambiguous column references
        from sqlalchemy.orm import aliased

        rm1 = aliased(room_members)
        rm2 = aliased(room_members)

        direct_room = (
            db.query(Room)
            .join(rm1, Room.id == rm1.c.room_id)
            .filter(and_(Room.is_group == False, rm1.c.user_id == current_user.id))
            .join(rm2, and_(rm2.c.room_id == Room.id, rm2.c.user_id == user.id))
            .first()
        )

        result.append(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "avatar": user.avatar
                or "/static/images/profile_photo.jpg",  # Default avatar if none
                "has_chat": direct_room is not None,
                "room_id": direct_room.id if direct_room else None,
            }
        )

    return result
