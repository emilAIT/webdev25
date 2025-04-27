from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Form,
    UploadFile,
    File,
    Body,
)
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from sqlalchemy.sql import text
from typing import List, Optional
import os
from datetime import datetime
import shutil
from pathlib import Path

from app.routers.session import get_db, get_current_user
from app.database import User, Room, Message, room_members, GroupChat
from app.routers.websockets import notify_new_group

router = APIRouter(prefix="/api")


# Get room details by ID
@router.get("/rooms/{room_id}")
async def get_room_details(
    room_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details of a room (direct chat or group)"""
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

    # Prepare response based on room type
    if room.is_group:
        # Get group chat details
        group_chat = db.query(GroupChat).filter(GroupChat.id == room_id).first()
        if not group_chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group details not found"
            )

        return {
            "id": room.id,
            "name": room.name,
            "is_group": True,
            "created_at": room.created_at.isoformat(),
            "description": group_chat.description,
            "avatar": group_chat.avatar,
        }
    else:
        # For direct chat, get the other user's details
        other_user_id = (
            db.query(room_members.c.user_id)
            .filter(
                and_(
                    room_members.c.room_id == room_id,
                    room_members.c.user_id != current_user.id,
                )
            )
            .scalar()
        )

        if not other_user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Chat partner not found"
            )

        other_user = db.query(User).filter(User.id == other_user_id).first()

        return {
            "id": room.id,
            "name": other_user.full_name or other_user.username,
            "username": other_user.username,
            "full_name": other_user.full_name,
            "avatar": other_user.avatar,
            "is_group": False,
            "user_id": other_user.id,
            "status": "online" if other_user.is_online else "offline",
            "created_at": room.created_at.isoformat(),
            "email": other_user.email,
        }


# Create a group chat
@router.post("/rooms/group")
async def create_group(
    name: str = Form(...),
    description: str = Form(None),
    member_ids: str = Form(...),  # Comma-separated user IDs
    avatar: Optional[UploadFile] = File(None),
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new group chat"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Parse member IDs - make sure current user is included automatically
    try:
        member_id_list = [int(id.strip()) for id in member_ids.split(",") if id.strip()]
        if not member_id_list:
            raise ValueError("No valid member IDs provided")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member IDs format"
        )

    # Add current user as admin if not already in the list
    if current_user.id not in member_id_list:
        member_id_list.append(current_user.id)

    # Verify all members exist
    users_count = (
        db.query(func.count(User.id)).filter(User.id.in_(member_id_list)).scalar()
    )
    if users_count != len(member_id_list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more members don't exist",
        )

    # Create a new group room
    new_room = Room(name=name, is_group=True, created_at=datetime.utcnow())
    db.add(new_room)
    db.flush()  # Flush to get the room ID

    # Handle avatar upload if provided
    avatar_path = None
    if avatar:
        # Create upload directory if it doesn't exist
        upload_dir = Path("app/static/uploads/group_avatars")
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Save the file with a unique name
        file_extension = os.path.splitext(avatar.filename)[1]
        avatar_filename = f"group_{new_room.id}{file_extension}"
        avatar_path = f"/static/uploads/group_avatars/{avatar_filename}"

        with open(f"app/{avatar_path}", "wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)

    # Create group chat info
    group_chat = GroupChat(
        id=new_room.id,  # Same ID as the room
        description=description,
        avatar=avatar_path,
    )
    db.add(group_chat)

    # Add all members to the room
    for user_id in member_id_list:
        from sqlalchemy import insert

        is_admin = user_id == current_user.id  # Only creator is admin initially

        db.execute(
            insert(room_members).values(
                room_id=new_room.id,
                user_id=user_id,
                joined_at=datetime.utcnow(),
                is_admin=is_admin,
            )
        )
    db.commit()

    # Notify members about the new group
    await notify_new_group(new_room.id, member_id_list, db)

    return {
        "id": new_room.id,
        "name": new_room.name,
        "is_group": True,
        "created_at": new_room.created_at.isoformat(),
        "description": description,
        "avatar": avatar_path,
    }


# Get members of a group
@router.get("/rooms/{room_id}/members")
async def get_group_members(
    room_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all members of a group chat"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if user is a member of this group
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
            detail="You don't have access to this group",
        )

    # Get all members
    members = (
        db.query(
            User.id, User.username, User.full_name, User.avatar, room_members.c.is_admin
        )
        .join(room_members, User.id == room_members.c.user_id)
        .filter(room_members.c.room_id == room_id)
        .all()
    )

    result = []
    for member in members:
        result.append(
            {
                "id": member.id,
                "username": member.username,
                "name": member.full_name or member.username,
                "avatar": member.avatar,
                "is_admin": member.is_admin,
            }
        )

    return result


# Add members to a group
@router.post("/rooms/{room_id}/members")
async def add_group_members(
    room_id: int,
    members: List[int] = Body(..., embed=True),  # List of user IDs
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add new members to a group chat"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if user is an admin of this group
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
            detail="Only admins can add members to the group",
        )

    # Verify all members exist
    users_count = db.query(func.count(User.id)).filter(User.id.in_(members)).scalar()
    if users_count != len(members):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more users don't exist",
        )

    # Get existing members to avoid duplicates
    existing_members = (
        db.query(room_members.c.user_id).filter(room_members.c.room_id == room_id).all()
    )
    existing_member_ids = [m.user_id for m in existing_members]

    # Add new members
    from sqlalchemy import insert

    added_members = []

    for user_id in members:
        if user_id not in existing_member_ids:
            db.execute(
                insert(room_members).values(
                    room_id=room_id,
                    user_id=user_id,
                    joined_at=datetime.utcnow(),
                    is_admin=False,
                )
            )
            added_members.append(user_id)

    db.commit()

    # Notify new members about being added to the group
    if added_members:
        await notify_new_group(room_id, added_members, db)

        new_members = (
            db.query(User.id, User.username, User.full_name, User.avatar)
            .filter(User.id.in_(added_members))
            .all()
        )

        result = []
        for member in new_members:
            result.append(
                {
                    "id": member.id,
                    "username": member.username,
                    "name": member.full_name or member.username,
                    "avatar": member.avatar,
                    "is_admin": False,
                }
            )

        return result
    else:
        return []


# Remove a member from a group
@router.delete("/rooms/{room_id}/members/{user_id}")
async def remove_group_member(
    room_id: int,
    user_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from a group chat"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if user is an admin of this group or removing themselves
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

    is_self_removal = current_user.id == user_id

    if not (is_admin or is_self_removal):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can remove members from the group",
        )

    # Check if target user is a member
    is_member = (
        db.query(room_members)
        .filter(
            and_(room_members.c.room_id == room_id, room_members.c.user_id == user_id)
        )
        .first()
        is not None
    )

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of this group",
        )

    # Cannot remove the last admin
    if is_admin and current_user.id != user_id:
        target_is_admin = (
            db.query(room_members)
            .filter(
                and_(
                    room_members.c.room_id == room_id,
                    room_members.c.user_id == user_id,
                    room_members.c.is_admin == True,
                )
            )
            .first()
            is not None
        )

        if target_is_admin:
            # Count other admins
            other_admins_count = (
                db.query(func.count(room_members.c.user_id))
                .filter(
                    and_(
                        room_members.c.room_id == room_id,
                        room_members.c.user_id != user_id,
                        room_members.c.is_admin == True,
                    )
                )
                .scalar()
            )

            if other_admins_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last admin from the group",
                )

    # Remove member
    db.execute(
        room_members.delete().where(
            and_(room_members.c.room_id == room_id, room_members.c.user_id == user_id)
        )
    )

    db.commit()

    # Check if this was the last member, delete group if empty
    members_count = (
        db.query(func.count(room_members.c.user_id))
        .filter(room_members.c.room_id == room_id)
        .scalar()
    )

    if members_count == 0:
        # Delete group info and room
        db.query(GroupChat).filter(GroupChat.id == room_id).delete()
        db.query(Room).filter(Room.id == room_id).delete()
        db.commit()

        return {
            "status": "success",
            "message": "Member removed and empty group deleted",
        }

    return {"status": "success", "message": "Member removed from group"}


# Leave a group
@router.post("/rooms/{room_id}/leave")
async def leave_group(
    room_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leave a group chat"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if user is a member
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this group",
        )

    # Check if user is the only admin
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

    if is_admin:
        # Count other admins
        other_admins_count = (
            db.query(func.count(room_members.c.user_id))
            .filter(
                and_(
                    room_members.c.room_id == room_id,
                    room_members.c.user_id != current_user.id,
                    room_members.c.is_admin == True,
                )
            )
            .scalar()
        )

        if other_admins_count == 0:
            # Count total members
            total_members = (
                db.query(func.count(room_members.c.user_id))
                .filter(room_members.c.room_id == room_id)
                .scalar()
            )

            if total_members > 1:
                # Promote someone else to admin if there are other members
                next_admin = (
                    db.query(room_members)
                    .filter(
                        and_(
                            room_members.c.room_id == room_id,
                            room_members.c.user_id != current_user.id,
                        )
                    )
                    .first()
                )

                if next_admin:
                    # Update the next admin
                    db.execute(
                        room_members.update()
                        .where(
                            and_(
                                room_members.c.room_id == room_id,
                                room_members.c.user_id == next_admin.user_id,
                            )
                        )
                        .values(is_admin=True)
                    )

    # Remove user from group
    db.execute(
        room_members.delete().where(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == current_user.id,
            )
        )
    )

    db.commit()

    # Check if this was the last member, delete group if empty
    members_count = (
        db.query(func.count(room_members.c.user_id))
        .filter(room_members.c.room_id == room_id)
        .scalar()
    )

    if members_count == 0:
        # Delete group info and room
        db.query(GroupChat).filter(GroupChat.id == room_id).delete()
        db.query(Room).filter(Room.id == room_id).delete()
        db.commit()

        return {
            "status": "success",
            "message": "You left the group and it was deleted since it's empty",
        }

    return {"status": "success", "message": "You left the group"}


# Delete a group (admin only)
@router.delete("/rooms/{room_id}/delete")
async def delete_group(
    room_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a group chat (admin only)"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if user is an admin of the group
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
            detail="Only admins can delete the group",
        )

    # Get member IDs before deleting the group to notify them
    member_ids = [
        member.user_id
        for member in db.query(room_members.c.user_id)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id
                != current_user.id,  # Exclude current user who is deleting the group
            )
        )
        .all()
    ]

    # Use the utility function to delete the room completely
    from app.routers.utils import delete_room_completely

    success = await delete_room_completely(room_id, db)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete the group",
        )

    # Notify all members that the group has been deleted
    from app.routers.websockets import notify_group_deleted

    if member_ids:
        await notify_group_deleted(room_id, member_ids, db)

    return {"status": "success", "message": "Group has been deleted"}


# Make a user an admin of a group
@router.post("/rooms/{room_id}/members/{user_id}/make-admin")
async def make_group_admin(
    room_id: int,
    user_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Make a user an admin of a group chat"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if current user is an admin
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
            detail="Only admins can make other users admins",
        )

    # Check if target user is a member
    is_member = (
        db.query(room_members)
        .filter(
            and_(room_members.c.room_id == room_id, room_members.c.user_id == user_id)
        )
        .first()
        is not None
    )

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of this group",
        )

    # Check if target user is already an admin
    is_already_admin = (
        db.query(room_members)
        .filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == user_id,
                room_members.c.is_admin == True,
            )
        )
        .first()
        is not None
    )

    if is_already_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User is already an admin"
        )

    # Make user admin
    db.execute(
        room_members.update()
        .where(
            and_(room_members.c.room_id == room_id, room_members.c.user_id == user_id)
        )
        .values(is_admin=True)
    )

    db.commit()

    return {"status": "success", "message": "User is now an admin"}


# Update group details (for any member)
@router.post("/rooms/{room_id}/update")
async def update_group(
    room_id: int,
    name: str = Form(...),
    description: str = Form(None),
    avatar: Optional[UploadFile] = File(None),
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update group details (any member can update)"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if room exists and is a group
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if not room.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a group chat"
        )

    # Check if user is a member of this group (no admin check required)
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
            detail="You must be a member to update group details",
        )

    # Update room name
    room.name = name.strip()

    # Get group chat details
    group_chat = db.query(GroupChat).filter(GroupChat.id == room_id).first()
    if not group_chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group details not found"
        )

    # Update group description
    group_chat.description = description.strip() if description else None

    # Handle avatar upload if provided
    if avatar:
        # Create upload directory if it doesn't exist
        upload_dir = Path("app/static/uploads/group_avatars")
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Save the file with a unique name
        file_extension = os.path.splitext(avatar.filename)[1]
        avatar_filename = (
            f"group_{room_id}_{int(datetime.utcnow().timestamp())}{file_extension}"
        )
        avatar_path = f"/static/uploads/group_avatars/{avatar_filename}"

        with open(f"app/{avatar_path}", "wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)

        # Update avatar path
        group_chat.avatar = avatar_path

    db.commit()

    return {
        "id": room.id,
        "name": room.name,
        "is_group": True,
        "created_at": room.created_at.isoformat(),
        "description": group_chat.description,
        "avatar": group_chat.avatar,
    }
