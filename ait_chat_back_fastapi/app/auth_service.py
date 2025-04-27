import json
import os
from datetime import timedelta, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db, SessionLocal
from .auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
    get_current_user, # Keep original get_current_user here as it depends on token logic
    get_password_hash,
    cleanup_expired_tokens,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter()

@router.post("/register", response_model=schemas.User)
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = (
        db.query(models.User).filter(models.User.username == user.username).first()
    )
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    db_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username, email=user.email, hashed_password=hashed_password
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # Create a refresh token
    refresh_token = create_refresh_token(user_id=user.id, db=db)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
    }


@router.post("/refresh-token", response_model=schemas.Token)
async def refresh_access_token(refresh_token: str, db: Session = Depends(get_db)):
    """Get a new access token using a valid refresh token.
    The refresh token is rotated for security - the old token is revoked
    and a new one is issued."""
    # Validate the refresh token
    user = validate_refresh_token(refresh_token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create a new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # Security: Revoke the old refresh token
    revoke_refresh_token(refresh_token, db)

    # Create a new refresh token
    new_refresh_token = create_refresh_token(user_id=user.id, db=db)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": new_refresh_token,
    }

# This depends on auth logic, so keep it close
@router.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# Manual token cleanup endpoint (can be moved if needed, but related to auth)
@router.post("/admin/cleanup-tokens", response_model=dict)
async def admin_cleanup_tokens(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user), # Still needs auth check
):
    """Manually trigger cleanup of expired refresh tokens"""
    # This could be restricted to admin users in a real application
    background_tasks.add_task(cleanup_expired_tokens, db)

    return {
        "message": "Token cleanup scheduled",
        "info": "Expired tokens will be marked as revoked in the background",
    } 