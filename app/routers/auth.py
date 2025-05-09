from fastapi import APIRouter, Request, Depends, HTTPException, status, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from typing import Optional
import bcrypt
import jwt
import os
from app.database import SessionLocal, User
from app.routers.session import manager

# JWT settings
SECRET_KEY = os.getenv(
    "SECRET_KEY", "your-secret-key"
)  # In production, use a secure key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

router = APIRouter(tags=["authentication"])
templates = Jinja2Templates(directory="app/templates")


# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    confirm_password: str


# Helper functions
def get_user(username: str):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    db.close()
    return user


def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def get_password_hash(password: str):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(login_input: str, password: str):
    db = SessionLocal()
    try:
        # Try to find user by username or email
        user = (
            db.query(User)
            .filter((User.username == login_input) | (User.email == login_input))
            .first()
        )

        if not user:
            return False
        if not verify_password(password, user.hashed_password):
            return False
        return user
    finally:
        db.close()


# Routes
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})


@router.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        # Return the username input so it can be preserved in the form
        return templates.TemplateResponse(
            "auth/login.html",
            {
                "request": request,
                "error": "Invalid username or password",
                "username": username,  # Pass the username back to preserve it
            },
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    # Generate WebSocket token using the manager
    ws_token = manager.create_token(user.username, user.id)

    # Update user's online status
    db = SessionLocal()
    try:
        db_user = db.query(User).filter(User.username == user.username).first()
        if db_user:
            db_user.is_online = True
            db_user.last_seen = datetime.utcnow()
            db.commit()
    except:
        db.rollback()
    finally:
        db.close()

    # Store tokens and user data in session
    request.session["access_token"] = access_token
    request.session["ws_token"] = ws_token
    request.session["username"] = user.username
    request.session["user_id"] = user.id

    return RedirectResponse("/chat", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/register", response_class=HTMLResponse, name="register_page")
async def register_page(request: Request):
    return templates.TemplateResponse("auth/registration.html", {"request": request})


@router.post("/register")
async def register(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
):
    if password != confirm_password:
        return templates.TemplateResponse(
            "auth/registration.html",
            {"request": request, "error": "Passwords do not match"},
        )
    db = SessionLocal()
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        db.close()
        return templates.TemplateResponse(
            "auth/registration.html",
            {"request": request, "error": "Username already exists"},
        )
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email:
        db.close()
        return templates.TemplateResponse(
            "auth/registration.html",
            {"request": request, "error": "Email already registered"},
        )
    hashed_password = get_password_hash(password)
    user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        full_name=username,
    )
    db.add(user)
    db.commit()
    db.close()
    return RedirectResponse("/login", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/logout")
async def logout(request: Request):
    # Update user's online status to offline
    if "username" in request.session:
        db = SessionLocal()
        try:
            username = request.session["username"]
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                db.commit()
        except:
            db.rollback()
        finally:
            db.close()

    # Clear session
    request.session.clear()
    return RedirectResponse("/login")


@router.get("/logoutadmin")
async def logout_admin(request: Request):
    """Special logout route for admin users that returns to login page"""
    # Update user's online status to offline (same as regular logout)
    if "username" in request.session:
        db = SessionLocal()
        try:
            username = request.session["username"]
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                db.commit()
        except:
            db.rollback()
        finally:
            db.close()

    # Clear session
    request.session.clear()
    return RedirectResponse("/login")


@router.post("/api/profile/update")
async def update_profile(request: Request):
    # Check if user is logged in
    if "username" not in request.session:
        return {"success": False, "message": "Not authenticated"}

    # Get form data
    form_data = await request.json()
    username = request.session["username"]

    db = SessionLocal()
    try:
        # Get current user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"success": False, "message": "User not found"}

        # Check if username is changed and not already taken
        username_changed = False
        if "username" in form_data and form_data["username"] != user.username:
            existing_username = (
                db.query(User).filter(User.username == form_data["username"]).first()
            )
            if existing_username:
                return {"success": False, "message": "Username already in use"}
            user.username = form_data["username"]
            username_changed = True

        # Check if email is changed and not already taken
        if "email" in form_data and form_data["email"] != user.email:
            existing_email = (
                db.query(User).filter(User.email == form_data["email"]).first()
            )
            if existing_email:
                return {"success": False, "message": "Email already in use"}
            user.email = form_data["email"]

        # Update other fields
        if "full_name" in form_data:
            user.full_name = form_data["full_name"]

        if "phone_number" in form_data:
            user.phone_number = form_data["phone_number"]

        if "country" in form_data:
            user.country = form_data["country"]

        # Save changes
        db.commit()

        # Update session if username changed
        if username_changed:
            # Create new access token with updated username
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": user.username}, expires_delta=access_token_expires
            )

            # Update session with new username and token
            request.session["access_token"] = access_token
            request.session["username"] = user.username

        return {"success": True, "message": "Profile updated successfully"}
    except Exception as e:
        db.rollback()
        return {"success": False, "message": str(e)}
    finally:
        db.close()


@router.get("/api/profile")
async def get_profile(request: Request):
    # Check if user is logged in
    if "username" not in request.session:
        return {"success": False, "message": "Not authenticated"}

    username = request.session["username"]
    db = SessionLocal()
    try:
        # Get current user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"success": False, "message": "User not found"}

        # Return user profile data
        return {
            "success": True,
            "data": {
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name or "",
                "phone_number": user.phone_number or "",
                "country": user.country or "",
                "id": user.id,
            },
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        db.close()
