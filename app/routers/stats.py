from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.routers.session import get_db
from app.database import User, Room, room_members, GroupChat

router = APIRouter(prefix="/api/stats")

@router.get("/users")
async def get_user_count(
    db: Session = Depends(get_db),
):
    """Get total number of registered users in the system"""
    user_count = db.query(func.count(User.id)).scalar()
    return {"total_users": user_count}

@router.get("/active-users")
async def get_active_user_count(
    db: Session = Depends(get_db),
):
    """Get number of currently active users in the system"""
    active_user_count = db.query(func.count(User.id)).filter(User.is_online == True).scalar()
    return {"active_users": active_user_count}

@router.get("/groups")
async def get_group_count(
    db: Session = Depends(get_db),
):
    """Get total number of groups in the system"""
    group_count = db.query(func.count(Room.id)).filter(Room.is_group == True).scalar()
    return {"total_groups": group_count}

@router.get("/groups/recent")
async def get_recent_group_count(
    db: Session = Depends(get_db),
):
    """Get number of groups created in the last 24 hours"""
    # Calculate timestamp for 24 hours ago
    yesterday = datetime.utcnow() - timedelta(hours=24)
    
    # Count groups created in the last 24 hours
    recent_group_count = db.query(func.count(Room.id))\
        .filter(Room.is_group == True)\
        .filter(Room.created_at >= yesterday)\
        .scalar()
        
    return {
        "recent_groups": recent_group_count,
        "timeframe": "24_hours"
    }