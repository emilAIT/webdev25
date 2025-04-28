# import sys
import os
# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import APIRouter, Request, Form, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates 
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.models.models import User
from backend.auth.security import hash_password, verify_password
from backend.celery_tasks.tasks import send_verification_email_task
import random
from backend.auth.token_utils import create_access_token, create_refresh_token, verify_refresh_token
from backend.session_tokens import store_access_token, store_refresh_token, get_session, store_verification_code, verify_code
from backend.auth.generation_keys import generate_and_store_keys
from datetime import timedelta
from backend.config import settings

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_MINUTES = settings.REFRESH_TOKEN_EXPIRE_MINUTES
EMAIL_MINUTES = settings.EMAIL_MINUTE

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "frontend", "templates"))

@router.get("/refresh")
async def refresh_token(request: Request, response: Response):
    print("Обновляем токен")
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        return RedirectResponse("/login")

    user_id = await verify_refresh_token(refresh_token)
    if not user_id:
        return RedirectResponse("/login")

    new_access_token = await create_access_token({"user_id": user_id})
    expiration_time_access = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    await store_access_token(user_id, new_access_token, expiration_time_access)

    response = RedirectResponse("/dash/", status_code=303)
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        max_age=expiration_time_access,
        httponly=True,
        # secure=True,
        samesite="Strict"
    )
    return response

@router.get("/register", response_class=HTMLResponse)
async def register_form(request: Request):
    print("Загружаем страницу register.html")
    return templates.TemplateResponse("register.html", {"request": request})

@router.post("/register")
async def register(request: Request, username: str = Form(...), email: str = Form(...), password: str = Form(...), db: AsyncSession = Depends(get_db)):
    query = select(User).where(or_(User.username == username, User.email == email))
    result = await db.execute(query)
    user = result.scalars().first()
    if user:
        print("Пользователь уже существует:", user)
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    print("User does not exist")

    code = str(random.randint(100000, 999999))

    await store_verification_code(email, code, expires_minutes=EMAIL_MINUTES)

    send_verification_email_task.apply_async(args=[email, code])

    request.session["username"] = username
    request.session["email"] = email
    request.session["password"] = hash_password(password)
    
    return RedirectResponse("/auth/verify", status_code=303)

@router.get("/verify", response_class=HTMLResponse)
async def verify_form(request: Request):
    print("Загружаем страницу verify.html")
    return templates.TemplateResponse("verify.html", {"request": request})

@router.post("/verify")
async def verify(request: Request, code: str = Form(...), db: AsyncSession = Depends(get_db)):
    email = request.session.get("email")

    if not await verify_code(email, code): 
        print("❌ Неверный код:", code)
        raise HTTPException(status_code=400, detail="Код недействителен или просрочен")

    user = User(
        username=request.session["username"],
        email=email,
        hashed_password=request.session["password"],
        is_verified=True
    )

    db.add(user)
    await db.commit()          
    await db.refresh(user)      

    print("✅ Пользователь сохранён:", user)
    return RedirectResponse("/dash/", status_code=303)

@router.post("/login")
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    # Запрос с явной загрузкой user_keys
    query = select(User).where(User.username == username).options(selectinload(User.user_keys))
    result = await db.execute(query)
    user = result.scalars().first()

    # Проверка учетных данных
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверные учетные данные")

    # Генерация токенов
    access_token = await create_access_token({"user_id": user.id})
    refresh_token = await create_refresh_token({"user_id": user.id})


    expiration_time_refresh = timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    expiration_time_access = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Если ключи отсутствуют, генерируем их
    if not user.user_keys:
        await generate_and_store_keys(user, db)
        # Обновляем объект user с новыми ключами
        await db.refresh(user)

    # Формируем ответ
    response = JSONResponse(content={
        "message": "Login successful",
        "access_token": refresh_token, 
        "encryptedPrivateKey": user.user_keys.encrypted_private_key if user.user_keys else None
    })

    # Установка куки
    response.set_cookie(
        "access_token",
        access_token,
        max_age=int(expiration_time_access.total_seconds()),
        httponly=True,
        samesite="Strict"
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=int(expiration_time_refresh.total_seconds()),
        httponly=True,
        samesite="Strict"
    )
    return response
