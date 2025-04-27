from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.database import GroupMember, User, Message, Contact
from typing import List
from datetime import datetime
from app.routers.session import active_connections, id_to_username

def format_message_time(timestamp: datetime) -> str:
    """Format message timestamp for display"""
    now = datetime.utcnow()
    
    if now.date() == timestamp.date():
        # Today, just show the time
        return timestamp.strftime("%H:%M")
    elif (now.date() - timestamp.date()).days == 1:
        # Yesterday
        return "Yesterday"
    else:
        # Other days, show date
        return timestamp.strftime("%d.%m.%Y")

def check_group_membership(db: Session, group_id: int, user_id: int) -> GroupMember:
    """Check if user is a member of the group and return membership record"""
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return membership

def check_group_admin(db: Session, group_id: int, user_id: int) -> GroupMember:
    """Check if user is an admin of the group and return admin record"""
    admin = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.is_admin == True
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action"
        )
    
    return admin

async def broadcast_presence_update(user_id: int, status: str, db: Session) -> None:
    """Broadcast online/offline status to all contacts"""
    username = id_to_username.get(user_id)
    if not username:
        return
    
    # Get all contacts of this user
    contacts = db.query(Contact, User).join(
        User, Contact.user_id == User.id
    ).filter(
        Contact.contact_id == user_id
    ).all()
    
    # Broadcast status to all online contacts
    for contact, contact_user in contacts:
        if contact_user.username in active_connections:
            await active_connections[contact_user.username].send_json({
                "type": "status_update",
                "user_id": user_id,
                "username": username,
                "status": status
            })

async def send_read_receipts(sender_id: int, messages: List[Message]) -> None:
    """Send read receipts to message sender"""
    sender_username = id_to_username.get(sender_id)
    if not sender_username or sender_username not in active_connections:
        return
    
    for msg in messages:
        await active_connections[sender_username].send_json({
            "type": "read_receipt",
            "message_id": msg.id,
            "read_at": msg.read_at.isoformat() if msg.read_at else datetime.utcnow().isoformat()
        })