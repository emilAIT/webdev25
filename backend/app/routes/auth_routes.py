from fastapi import APIRouter, Depends, HTTPException, Request, Form, status, Body
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict
import uuid
import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

from ..database.database import get_db
from ..models.models import User
from ..services.auth import (
    hash_password,
    authenticate_user,
    create_session,
    get_current_user,
    user_sessions,
    password_reset_tokens,
)

# Configure templates
templates_path = Path("../frontend/templates")
templates = Jinja2Templates(directory=templates_path)

# Create router for auth routes
router = APIRouter()

# Загружаем переменные окружения из .env файла
# Убедитесь, что файл .env находится в корне проекта или укажите правильный путь
dotenv_path = (
    Path(__file__).resolve().parents[3] / ".env"
)  # Путь к .env в корне проекта
load_dotenv(dotenv_path=dotenv_path)

MAIL_SERVER = os.getenv("MAIL_SERVER")
MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_SENDER_NAME = os.getenv("MAIL_SENDER_NAME", "MeowChat")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL", "http://127.0.0.1:8000"
)  # URL фронтенда для ссылки


# Функция для отправки email
def send_password_reset_email(recipient_email: str, reset_link: str):
    if not all([MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD]):
        print("---!!! ERROR: Email environment variables are not configured !!!---")
        print(f"Password reset link for {recipient_email}: {reset_link}")
        print("-------------------------------------------------------------------")
        return  # Just print to console if not configured

    msg = EmailMessage()
    msg.set_content(
        f"""
    Hello!

    You (or someone else) requested a password reset for your MeowChat account.
    Please click the link below to set a new password:
    {reset_link}

    This link is valid for 1 hour.
    If you did not request a password reset, please ignore this email.

    Best regards,
    The MeowChat Team
    """
    )

    msg["Subject"] = f"Password Reset for MeowChat"
    msg["From"] = f"{MAIL_SENDER_NAME} <{MAIL_USERNAME}>"
    msg["To"] = recipient_email

    try:
        # Подключаемся к SMTP серверу и отправляем письмо
        server = smtplib.SMTP(MAIL_SERVER, MAIL_PORT)
        server.starttls()  # Используем TLS шифрование
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Письмо для сброса пароля  отправлено на {recipient_email}")
    except Exception as e:
        print(f"---!!! ОШИБКА отправки email на {recipient_email}: {e} !!!---")
        # Можно добавить логирование ошибки здесь


@router.get("/", response_class=HTMLResponse)
async def landing_page(request: Request, user=Depends(get_current_user)):
    """Render landing page or redirect to chat if logged in"""
    if user:
        return RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse("landing.html", {"request": request})


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, user=Depends(get_current_user)):
    """Render login page or redirect to chat if logged in"""
    if user:
        return RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse("login.html", {"request": request})


@router.post("/login")
async def login(
    request: Request,
    login_id: str = Form(...),  # Can be either email or username
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """Handle user login with either email or username. Returns JSON on error."""
    auth_result = authenticate_user(db, login_id, password)

    if isinstance(auth_result, str):  # Check if an error string was returned
        error_message = ""
        status_code = status.HTTP_401_UNAUTHORIZED  # Default status
        if auth_result == "user_not_found":
            error_message = "User not found"
            # Could use 404, but 401 is also suitable for security
        elif auth_result == "incorrect_password":
            error_message = "Incorrect password"
        else:
            error_message = "Unknown authentication error"
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        # Return JSON with error and status
        return JSONResponse(status_code=status_code, content={"detail": error_message})

    # If not a string, it's a user object - authentication successful
    user = auth_result
    session_id = create_session(user.id)

    # On successful login via fetch, the frontend will handle the redirect itself.
    # Therefore, return JSON with success and the redirect URL.
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"success": True, "redirect_url": "/chat"},
        headers={
            "Set-Cookie": f"session_id={session_id}; HttpOnly; Path=/"
        },  # Устанавливаем куку
    )


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request, user=Depends(get_current_user)):
    """Render registration page or redirect to chat if logged in"""
    if user:
        return RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse("register.html", {"request": request})


@router.post("/register")
async def register(
    request: Request,
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    avatar: str = Form(default="/static/images/meow-icon.jpg"),
    db: Session = Depends(get_db),
):
    """Handle user registration"""
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email:
        return templates.TemplateResponse(
            "register.html", {"request": request, "error": "Email already registered"}
        )

    # Check if username already exists
    existing_username = db.query(User).filter(User.username == username).first()
    if existing_username:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": "Имя пользователя уже занято"},
        )

    # Create new user
    hashed_password = hash_password(password)
    new_user = User(
        email=email,
        username=username,
        password=hashed_password,
        avatar=avatar,
        created_at=datetime.utcnow(),
    )
    db.add(new_user)
    db.commit()

    return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/logout")
async def logout(request: Request):
    """Handle user logout"""
    session_id = request.cookies.get("session_id")
    if session_id and session_id in user_sessions:
        del user_sessions[session_id]

    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(key="session_id")
    return response


@router.post("/request-password-reset")
async def request_password_reset(
    request: Request,
    email_data: Dict[str, str] = Body(...),
    db: Session = Depends(get_db),
):
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = db.query(User).filter(User.email == email).first()

    if user:
        # Генерируем токен
        token = str(uuid.uuid4())
        expiry_time = datetime.now(timezone.utc) + timedelta(
            hours=1
        )  # Токен действителен 1 час

        # Сохраняем токен (В ПРОДАКШЕНЕ - В БД ИЛИ REDIS)
        password_reset_tokens[token] = {"user_id": user.id, "expires": expiry_time}

        # Формируем ссылку для сброса с использованием переменной окружения
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

        # --- ОТПРАВЛЯЕМ EMAIL ---
        send_password_reset_email(user.email, reset_link)
        # --- КОНЕЦ ОТПРАВКИ EMAIL ---

    # Всегда возвращаем успешный ответ, чтобы не раскрывать существование email
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "detail": "If an account exists for this email, a password reset link has been sent."
        },
    )


@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request, token: str):
    """Display the password reset page if the token is valid."""
    token_data = password_reset_tokens.get(token)
    now = datetime.now(timezone.utc)

    # Проверяем, существует ли токен и не истек ли он
    if not token_data or token_data["expires"] < now:
        # Показываем страницу с сообщением об ошибке или просто редирект на логин
        # Здесь для простоты показываем шаблон с ошибкой
        return templates.TemplateResponse(
            "reset_password.html",
            {
                "request": request,
                "token": token,
                "error": "Invalid or expired password reset link.",
            },
        )

    # Если токен валиден, отображаем форму
    return templates.TemplateResponse(
        "reset_password.html", {"request": request, "token": token}
    )


@router.post("/reset-password")
async def handle_reset_password(
    request: Request,
    reset_data: Dict[str, str] = Body(...),
    db: Session = Depends(get_db),
):
    """Handle the password reset form submission."""
    token = reset_data.get("token")
    new_password = reset_data.get("new_password")

    if not token or not new_password:
        raise HTTPException(
            status_code=400, detail="Token and new password are required"
        )

    if len(new_password) < 6:  # Примерная проверка длины
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters long"
        )

    # Проверяем токен
    token_data = password_reset_tokens.get(token)
    now = datetime.now(timezone.utc)

    if not token_data or token_data["expires"] < now:
        raise HTTPException(
            status_code=400, detail="Invalid or expired password reset link"
        )

    user_id = token_data["user_id"]
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        # Этого не должно произойти, если токен валиден, но проверим
        raise HTTPException(
            status_code=404, detail="User associated with token not found"
        )

    # Обновляем пароль пользователя
    user.password = hash_password(new_password)
    db.commit()

    # Удаляем (инвалидируем) токен из хранилища
    if token in password_reset_tokens:
        del password_reset_tokens[token]

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"detail": "Password reset successfully!"},
    )
