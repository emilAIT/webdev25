import bcrypt
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import Request, Depends
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..models.models import User

# Global session store - for simplicity, but would use Redis in production
user_sessions: Dict[str, Dict[str, Any]] = {}

# Global password reset token store - VERY insecure for production!
password_reset_tokens: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_session(user_id: int) -> str:
    """Create a new session for a user"""
    session_id = str(uuid.uuid4())
    user_sessions[session_id] = {"user_id": user_id, "created_at": datetime.utcnow()}
    return session_id


def get_user_from_session(session_id: str) -> Optional[int]:
    """Get user ID from session ID"""
    if session_id in user_sessions:
        return user_sessions[session_id]["user_id"]
    return None


async def get_current_user(request: Request, db: Session = Depends(get_db)):
    """Get the current user from the session"""
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None

    user_id = get_user_from_session(session_id)
    if not user_id:
        return None

    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, login_id: str, password: str) -> User | str:
    """
    Authenticate a user with either email or username

    Args:
        db: Database session
        login_id: Either email or username
        password: User password

    Returns:
        User object if authentication successful, or error string otherwise
    """
    # Check if login_id is an email (contains @)
    if "@" in login_id:
        user = db.query(User).filter(User.email == login_id).first()
    else:
        user = db.query(User).filter(User.username == login_id).first()

    if not user:
        return "user_not_found"

    if not verify_password(password, user.password):
        return "incorrect_password"

    # Update last_seen timestamp on successful login
    user.last_seen = datetime.utcnow()
    db.commit()

    return user
