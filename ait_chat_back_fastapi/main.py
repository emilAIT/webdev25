import json
import os
import asyncio
from datetime import timedelta, datetime, timezone
from typing import List, Dict, Optional
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
    Path,
    BackgroundTasks,
    Query,
    Request,
    File,
    UploadFile,
    Form,
)
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import or_, and_, func, select
from pathlib import Path as PathLib

from app import models
from app import schemas
from app.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
    get_current_user,
    get_password_hash,
    cleanup_expired_tokens,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_MINUTES,
)
from app.database import get_db, engine, SessionLocal
from app.schemas import Folder, FolderCreate, FolderUpdate, FolderWithGroups
from app.storage import (
    storage_client,
    ALLOWED_MEDIA_TYPES,
    MAX_FILE_SIZE,
    LOCAL_STORAGE_PATH,
    STORAGE_TYPE,
    GCP_BUCKET_NAME,
    LocalStorageClient,
)

# Import the routers from the service files
from app import auth_service, user_service, group_service, chat_service

# Create/Update tables in the database
# NOTE: This doesn't handle migrations for existing databases.
# Consider using Alembic for production.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Chat API",
    description="FastAPI Chat Backend with WebSockets",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(
        ","  # In production, specify your frontend URL
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monturuem kaталог медиафайлов для локального хранилища
if STORAGE_TYPE == "local":
    media_directory = PathLib(LOCAL_STORAGE_PATH)
    media_directory.mkdir(exist_ok=True)
    app.mount("/media", StaticFiles(directory=LOCAL_STORAGE_PATH), name="media")
else:
    print(f"Using Google Cloud Storage with bucket: {GCP_BUCKET_NAME}")

# Include the routers from the service files
app.include_router(auth_service.router, tags=["Authentication"])
app.include_router(user_service.router, tags=["Users & Contacts"])
app.include_router(group_service.router, tags=["Groups & Folders"])
app.include_router(chat_service.router, tags=["Chat & Media"])

# WebSocket connection manager - Enhanced for Status
