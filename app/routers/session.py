from fastapi import Request, HTTPException, status, WebSocket, Depends, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.sql import and_
from typing import Dict, Any, Set, Optional
from app.database import SessionLocal, User, room_members
import jwt
import os
from datetime import datetime, timedelta

# WebSocket connections - map username to set of websockets
active_connections: Dict[str, Set[WebSocket]] = {}
# Map usernames to user IDs
username_to_id: Dict[str, int] = {}
# Map user IDs to usernames
id_to_username: Dict[int, str] = {}

# Secret key for JWT token generation
SECRET_KEY = os.getenv("SECRET_KEY", "SECRET_KEY_FOR_JWT_GENERATION")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

class ConnectionManager:
    """Manage WebSocket connections and authentication"""
    
    def __init__(self):
        pass
    
    async def connect(self, websocket: WebSocket, username: str):
        """Connect a WebSocket and associate with username"""
        await websocket.accept()
        if username not in active_connections:
            active_connections[username] = set()
        active_connections[username].add(websocket)
    
    async def disconnect(self, websocket: WebSocket, username: str):
        """Disconnect a WebSocket"""
        if username in active_connections:
            active_connections[username].discard(websocket)
            if not active_connections[username]:
                # Clean up empty connection sets
                del active_connections[username]
                # Remove from username mappings if present
                if username in id_to_username.values():
                    user_id = next((k for k, v in id_to_username.items() if v == username), None)
                    if user_id:
                        del id_to_username[user_id]
                        del username_to_id[username]
    
    def create_token(self, username: str, user_id: int, room_id: int = None) -> str:
        """Create JWT token for WebSocket authentication"""
        expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sub": username, "id": user_id, "exp": expires}
        if room_id:
            to_encode["room_id"] = room_id
        token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return token
    
    async def get_user_from_token(self, token: str, db: Session) -> Optional[User]:
        """Validate token and get user"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username is None:
                return None
            
            # Get user from database
            user = db.query(User).filter(User.username == username).first()
            if not user:
                return None
            
            return user
        except Exception as e:
            print(f"Token validation error: {e}")
            return None

# Create singleton instance of connection manager
manager = ConnectionManager()

# Database dependency
def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Chat middleware to check if user is logged in
def get_current_user(request: Request):
    """Get current logged-in user from session"""
    username = request.session.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return username

def get_current_user_from_session(request: Request, db: Session) -> User:
    """Get current User object from session"""
    username = request.session.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Not authenticated"
        )
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    
    return user

# Add token generation endpoint
router = APIRouter()

@router.get("/api/token/chat")
async def generate_chat_token(roomId: int, request: Request, db: Session = Depends(get_db)):
    """Generate a token for WebSocket chat authentication"""
    username = request.session.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    
    # Check if user is member of the room
    is_member = db.query(room_members).filter(
        and_(
            room_members.c.room_id == roomId,
            room_members.c.user_id == user.id
        )
    ).first() is not None
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room"
        )
    
    # Generate token
    token = manager.create_token(username, user.id, roomId)
    
    return {"token": token}