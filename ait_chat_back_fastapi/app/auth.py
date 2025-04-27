from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import uuid
import os
import secrets

from .database import get_db
from .models import User, RefreshToken

# JWT settings - Use environment variables
SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY", secrets.token_hex(32)
)  # Generate a random key if not provided
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "10080")
)  # 7 days

# Strengthen password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: int, db: Session):
    """Create a new refresh token for a user"""
    # Generate a unique token using uuid
    token_value = str(uuid.uuid4())

    # Calculate expiration time
    expires_at = datetime.utcnow() + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)

    # Create and save the refresh token
    db_token = RefreshToken(token=token_value, user_id=user_id, expires_at=expires_at)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)

    return token_value


def validate_refresh_token(token: str, db: Session):
    """Validate a refresh token and return the associated user if valid"""
    db_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == token,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not db_token:
        return None

    return db.query(User).filter(User.id == db_token.user_id).first()


def revoke_refresh_token(token: str, db: Session):
    """Revoke a refresh token so it can't be used anymore"""
    db_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if db_token:
        db_token.revoked = True
        db.commit()
        return True
    return False


def cleanup_expired_tokens(db: Session):
    """Remove expired refresh tokens from the database"""
    # Mark expired tokens as revoked
    expired_tokens = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.revoked == False,
            RefreshToken.expires_at < datetime.utcnow(),
        )
        .all()
    )

    for token in expired_tokens:
        token.revoked = True

    if expired_tokens:
        db.commit()
        return len(expired_tokens)
    return 0


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user
