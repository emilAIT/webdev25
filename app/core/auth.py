"""Authentication related functions and utilities"""
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.config import RECAPTCHA_SECRET_KEY, RECAPTCHA_VERIFY_URL, logger
from app.models.schemas import TokenData
from app.utils.password import verify_password
from app.db.database import get_db_connection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_recaptcha(recaptcha_response):
    """Verify reCAPTCHA response with Google API"""
    try:
        logger.info("Verifying reCAPTCHA response")
        payload = {
            'secret': RECAPTCHA_SECRET_KEY,
            'response': recaptcha_response
        }
        response = requests.post(RECAPTCHA_VERIFY_URL, data=payload)
        result = response.json()
        logger.info(f"reCAPTCHA verification result: {result}")
        return result.get('success', False)
    except Exception as e:
        logger.error(f"reCAPTCHA verification error: {str(e)}")
        return False

# Move this function here to avoid circular imports
def get_user_by_phone(phone):
    """Get user from database by phone number"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
    user = cursor.fetchone()
    conn.close()
    return user

def authenticate_user(phone, password):
    """Authenticate user with phone and password"""
    user = get_user_by_phone(phone)
    if not user:
        return False
    if not verify_password(password, user['password_hash']):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Validate JWT token and return current user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone: str = payload.get("sub")
        if phone is None:
            raise credentials_exception
        token_data = TokenData(phone=phone)
    except JWTError:
        raise credentials_exception
    user = get_user_by_phone(token_data.phone)
    if user is None:
        raise credentials_exception
    return user

async def get_current_user_from_token(token: str):
    """Validate JWT token and return current user (for WebSocket connections)"""
    try:
        if not token:
            logger.warning("WebSocket authentication failed: Token is empty")
            return None
            
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone: str = payload.get("sub")
        if phone is None:
            logger.warning("WebSocket authentication failed: No 'sub' claim in token")
            return None
            
        user = get_user_by_phone(phone)
        if user is None:
            logger.warning(f"WebSocket authentication failed: User with phone {phone} not found")
            return None
            
        logger.info(f"WebSocket authentication successful for user {user['id']}")
        return user
    except JWTError as e:
        logger.error(f"WebSocket token validation error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected WebSocket authentication error: {str(e)}")
        return None
