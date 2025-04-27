from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from core.database import get_db
from services import auth as auth_service
from db.models import User

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Регистрация
@router.post("/register")
def register(request: UserCreate, db: Session = Depends(get_db)):
    # Проверка username
    new_user = auth_service.get_user_by_username(db, request.username)
    if new_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Проверка email
    user_by_email = auth_service.get_user_by_email(db, request.email)
    if user_by_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Создание пользователя
    user = auth_service.create_user(db, request.username, request.email, request.password)
    return {"message": "User created successfully", "user_id": user.id}

# Логин (по email и паролю через JSON)
@router.post("/login")
def login(request: UserLogin, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user_by_email(db, email=request.email, password=request.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    token = auth_service.create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


