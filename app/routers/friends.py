from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.database import User, Friendship, FriendStatus
from app.routers.session import get_db, get_current_user, active_connections
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/friends")


@router.get("/status/{user_id}/{friend_id}")
async def check_friendship_status(
    user_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    """Check friendship status between two users"""
    # Verify current user matches user_id or friend_id for security
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user or (
        current_user.id != user_id and current_user.id != friend_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only check friendship status for yourself",
        )

    # Check if users exist
    user = db.query(User).filter(User.id == user_id).first()
    friend = db.query(User).filter(User.id == friend_id).first()

    if not user or not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="One or both users not found"
        )

    # Check for friendship in either direction
    friendship = (
        db.query(Friendship)
        .filter(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id),
            )
        )
        .first()
    )

    if not friendship:
        return {"status": "none"}

    # Determine friendship direction and status
    if friendship.status == FriendStatus.ACCEPTED:
        return {"status": "accepted"}
    elif friendship.user_id == user_id:
        return {"status": "pending"}  # Outgoing request
    else:
        return {"status": "incoming"}  # Incoming request


@router.post("/add/{user_id}/{friend_id}")
async def add_friend(
    user_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    """Send a friend request"""
    # Verify current user matches user_id for security
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user or current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only send friend requests from your own account",
        )

    # Prevent sending request to yourself
    if user_id == friend_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a friend request to yourself",
        )

    # Check if friend exists
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if friendship already exists
    existing_friendship = (
        db.query(Friendship)
        .filter(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id),
            )
        )
        .first()
    )

    if existing_friendship:
        if existing_friendship.status == FriendStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already friends with this user",
            )
        elif existing_friendship.status == FriendStatus.PENDING:
            if existing_friendship.user_id == user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You already sent a friend request to this user",
                )
            else:
                # Auto-accept if they already sent a request to you
                existing_friendship.status = FriendStatus.ACCEPTED
                db.commit()
                return {
                    "success": True,
                    "message": f"Friend request from {friend.username} accepted",
                }

    # Create new friendship
    new_friendship = Friendship(
        user_id=user_id,
        friend_id=friend_id,
        status=FriendStatus.PENDING,
        created_at=datetime.utcnow(),
    )

    db.add(new_friendship)
    db.commit()

    # Notify the recipient if they're online
    if friend.username in active_connections:
        for websocket in active_connections[friend.username]:
            await websocket.send_json(
                {
                    "type": "friend_request",
                    "from": {"id": user_id, "username": current_user.username},
                }
            )

    return {"success": True, "message": f"Friend request sent to {friend.username}"}


@router.post("/accept/{user_id}/{friend_id}")
async def accept_friend(
    user_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    """Accept a friend request"""
    # Verify current user matches user_id for security
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user or current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only accept friend requests for your own account",
        )

    # Check if friend exists
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if friendship request exists
    friendship = (
        db.query(Friendship)
        .filter(
            and_(
                Friendship.user_id == friend_id,
                Friendship.friend_id == user_id,
                Friendship.status == FriendStatus.PENDING,
            )
        )
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending friend request from this user",
        )

    # Accept the request
    friendship.status = FriendStatus.ACCEPTED
    db.commit()

    # Notify the original sender if they're online
    if friend.username in active_connections:
        for websocket in active_connections[friend.username]:
            await websocket.send_json(
                {
                    "type": "friend_request_accepted",
                    "by": {"id": user_id, "username": current_user.username},
                }
            )

    return {"success": True, "message": f"You are now friends with {friend.username}"}


@router.post("/remove/{user_id}/{friend_id}")
async def remove_friend(
    user_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    """Remove a friend or cancel/decline a friend request"""
    # Verify current user matches user_id for security
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user or current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own friendships",
        )

    # Find friendship in either direction
    friendship = (
        db.query(Friendship)
        .filter(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id),
            )
        )
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No friendship found"
        )

    # Get friend user object for notification
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Delete the friendship
    db.delete(friendship)
    db.commit()

    # Notify the other user if they're online
    if friend.username in active_connections:
        for websocket in active_connections[friend.username]:
            await websocket.send_json(
                {
                    "type": "friendship_removed",
                    "by": {"id": user_id, "username": current_user.username},
                }
            )

    return {"success": True, "message": f"Friendship with {friend.username} removed"}


@router.get("/list")
async def get_friends(
    db: Session = Depends(get_db), username: str = Depends(get_current_user)
):
    """Get all friends for the current user"""
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Get all accepted friendships
    # For friends where current user sent the request
    sent_friendships = (
        db.query(Friendship, User)
        .join(User, User.id == Friendship.friend_id)
        .filter(
            and_(
                Friendship.user_id == current_user.id,
                Friendship.status == FriendStatus.ACCEPTED,
            )
        )
        .all()
    )

    # For friends where current user received the request
    received_friendships = (
        db.query(Friendship, User)
        .join(User, User.id == Friendship.user_id)
        .filter(
            and_(
                Friendship.friend_id == current_user.id,
                Friendship.status == FriendStatus.ACCEPTED,
            )
        )
        .all()
    )

    # Combine the results
    friends = []

    for friendship, user in sent_friendships:
        friends.append(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "avatar": user.avatar,
                "is_online": user.is_online,
                "last_seen": user.last_seen.isoformat() if user.last_seen else None,
            }
        )

    for friendship, user in received_friendships:
        friends.append(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "avatar": user.avatar,
                "is_online": user.is_online,
                "last_seen": user.last_seen.isoformat() if user.last_seen else None,
            }
        )

    return {"friends": friends}


@router.get("/pending")
async def get_pending_friends(
    db: Session = Depends(get_db), username: str = Depends(get_current_user)
):
    """Get pending friend requests for the current user"""
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Get all pending friend requests received by current user
    pending_requests = (
        db.query(Friendship, User)
        .join(User, User.id == Friendship.user_id)
        .filter(
            and_(
                Friendship.friend_id == current_user.id,
                Friendship.status == FriendStatus.PENDING,
            )
        )
        .all()
    )

    # Format the results
    requests = []
    for friendship, user in pending_requests:
        requests.append(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "avatar": user.avatar,
                "created_at": friendship.created_at.isoformat(),
            }
        )

    return {"requests": requests}


@router.get("/sent")
async def get_sent_requests(
    db: Session = Depends(get_db), username: str = Depends(get_current_user)
):
    """Get friend requests sent by the current user"""
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Get all pending friend requests sent by current user
    sent_requests = (
        db.query(Friendship, User)
        .join(User, User.id == Friendship.friend_id)
        .filter(
            and_(
                Friendship.user_id == current_user.id,
                Friendship.status == FriendStatus.PENDING,
            )
        )
        .all()
    )

    # Format the results
    requests = []
    for friendship, user in sent_requests:
        requests.append(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "avatar": user.avatar,
                "created_at": friendship.created_at.isoformat(),
            }
        )

    return {"requests": requests}
