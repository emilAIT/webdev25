from datetime import timedelta
from fastapi import APIRouter, Response, HTTPException, status

from app.core.auth import authenticate_user, verify_recaptcha, create_access_token
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, logger
from app.db.user_crud import get_user_by_phone, get_user_by_email, create_user
from app.models.schemas import UserCreate, UserLogin, Token

router = APIRouter()

@router.post("/register", response_model=dict)
async def register_user(user: UserCreate):
    """Register a new user"""
    # Verify reCAPTCHA
    logger.info("Processing registration request")
    recaptcha_verified = verify_recaptcha(user.recaptcha)
    
    if not recaptcha_verified:
        logger.warning(f"reCAPTCHA verification failed for registration attempt with email: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reCAPTCHA verification failed"
        )
    
    # Check if user already exists
    if get_user_by_phone(user.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    if get_user_by_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user_id = create_user(user.nickname, user.email, user.phone, user.password)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User creation failed"
        )
    
    return {"message": "Registration successful! Please sign in."}

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, response: Response):
    """Login user and return access token"""
    # Verify reCAPTCHA
    logger.info("Processing login request")
    recaptcha_verified = verify_recaptcha(user_data.recaptcha)
    
    if not recaptcha_verified:
        logger.warning(f"reCAPTCHA verification failed for login attempt with phone: {user_data.phone}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reCAPTCHA verification failed"
        )
    
    # Authenticate user
    user = authenticate_user(user_data.phone, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES * (30 if user_data.remember_me else 1)
    )
    access_token = create_access_token(
        data={"sub": user['phone']},
        expires_delta=access_token_expires
    )
    
    # Set token in HTTP-only cookie
    max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60 * (60 if user_data.remember_me else 10)
    response.set_cookie(
        key="access_token", 
        value=access_token, 
        httponly=True,
        max_age=max_age,
        secure=True,
        samesite="strict"
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
