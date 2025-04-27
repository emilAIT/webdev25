from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core.auth import get_current_user
from app.core.config import logger
from app.db.user_crud import get_user_by_id  # Import to fetch user details

# Setup templates
templates = Jinja2Templates(directory="templates")

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Render the authentication page"""
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request):
    """Render the chat page for authenticated users"""
    try:
        # First try to get token from Authorization header
        authorization = request.headers.get("Authorization")
        
        # If the Authorization header is not set, try to get the token from cookies
        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split("Bearer ")[1]
        else:
            # Check if token exists in cookies
            token = request.cookies.get("access_token")
            
        if not token:
            # No token found in headers or cookies
            raise HTTPException(status_code=401, detail="Authentication required")
            
        # Validate the token
        current_user = await get_current_user(token)
        
        # Улучшенный способ извлечения фотографии профиля
        profile_photo = None
        try:
            if isinstance(current_user, dict):
                # Если объект словарь, используем метод get
                profile_photo = current_user.get("profile_photo")
            elif hasattr(current_user, "__getitem__"):
                # Для объектов типа SQLite Row
                try:
                    profile_photo = current_user["profile_photo"]
                except (KeyError, IndexError):
                    profile_photo = None
            elif hasattr(current_user, "profile_photo"):
                # Для объектов с атрибутом profile_photo
                profile_photo = current_user.profile_photo
        except Exception as e:
            logger.error(f"Ошибка при получении фото профиля: {str(e)}")
            profile_photo = None
            
        # Проверяем, что profile_photo не None, пустая строка или "None"
        if profile_photo in [None, "", "None"]:
            profile_photo = None
            
        logger.info(f"Фото профиля для пользователя {current_user['id']}: {profile_photo}")
            
        # If successful, render the chat page
        response = templates.TemplateResponse(
            "chat.html", 
            {
                "request": request, 
                "user": {
                    "id": current_user["id"],
                    "name": current_user["nickname"],
                    "status": "Online",
                    "profile_photo": profile_photo
                }
            }
        )
        
        # Ensure the token is set in cookies for future requests
        response.set_cookie(key="access_token", value=token, httponly=True, secure=True, samesite="strict")
        
        return response
            
    except Exception as e:
        # If token validation fails, redirect to login page with error message
        logger.error(f"Authentication error: {str(e)}")
        return HTMLResponse(
            content=f"""
            <script>
                localStorage.removeItem('access_token');
                console.error("Authentication error: {str(e)}");
                window.location.href = '/';
            </script>
            """,
            status_code=401
        )

@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    """Render the profile page for authenticated users"""
    try:
        # First try to get token from Authorization header
        authorization = request.headers.get("Authorization")
        
        # If the Authorization header is not set, try to get the token from cookies
        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split("Bearer ")[1]
        else:
            # Check if token exists in cookies
            token = request.cookies.get("access_token")
            
        if not token:
            # No token found in headers or cookies
            raise HTTPException(status_code=401, detail="Authentication required")
            
        # Validate the token
        current_user = await get_current_user(token)
        
        # Получаем фото профиля так же, как в chat_page
        profile_photo = None
        try:
            if isinstance(current_user, dict):
                profile_photo = current_user.get("profile_photo")
            elif hasattr(current_user, "__getitem__"):
                try:
                    profile_photo = current_user["profile_photo"]
                except (KeyError, IndexError):
                    profile_photo = None
            elif hasattr(current_user, "profile_photo"):
                profile_photo = current_user.profile_photo
        except Exception as e:
            logger.error(f"Ошибка при получении фото профиля: {str(e)}")
            profile_photo = None
            
        # Проверяем, что profile_photo не None, пустая строка или "None"
        if profile_photo in [None, "", "None"]:
            profile_photo = None
            
        logger.info(f"Фото профиля для пользователя {current_user['id']}: {profile_photo}")
        
        # If successful, render the profile page
        return templates.TemplateResponse(
            "profile.html", 
            {
                "request": request, 
                "user": {
                    "id": current_user["id"],
                    "name": current_user["nickname"],
                    "status": "Online",
                    "profile_photo": profile_photo
                }
            }
        )
            
    except Exception as e:
        # If token validation fails, redirect to login page with error message
        logger.error(f"Authentication error: {str(e)}")
        return HTMLResponse(
            content=f"""
            <script>
                localStorage.removeItem('access_token');
                console.error("Authentication error: {str(e)}");
                window.location.href = '/';
            </script>
            """,
            status_code=401
        )

@router.get("/videocall/{chat_id}", response_class=HTMLResponse)
async def videocall_page(request: Request, chat_id: int = 0):
    """Render the video call page for the current user"""
    try:
        # Extract token from headers or cookies
        authorization = request.headers.get("Authorization")
        token = None
        
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split("Bearer ")[1]
        else:
            # Check if token exists in cookies
            token = request.cookies.get("access_token")
            
        if not token:
            # No token found in headers or cookies
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Validate the token
        current_user = await get_current_user(token)
        
        # Extract profile photo with careful error handling
        profile_photo = None
        try:
            if isinstance(current_user, dict):
                profile_photo = current_user.get("profile_photo")
            elif hasattr(current_user, "__getitem__"):
                try:
                    profile_photo = current_user["profile_photo"]
                except (KeyError, IndexError):
                    profile_photo = None
            elif hasattr(current_user, "profile_photo"):
                profile_photo = current_user.profile_photo
        except Exception as e:
            logger.error(f"Error getting profile photo: {str(e)}")
            profile_photo = None
            
        # Validate profile_photo
        if profile_photo in [None, "", "None"]:
            profile_photo = None
        
        # Render the video call page with the current user's information
        return templates.TemplateResponse(
            "videocall.html",
            {
                "request": request,
                "current_user": {
                    "id": current_user["id"],
                    "name": current_user["nickname"],
                    "profile_photo": profile_photo
                },
                "chat_id": chat_id,
                "token": token
            }
        )
    except Exception as e:
        logger.error(f"Error rendering video call page: {str(e)}")
        return HTMLResponse(
            content=f"""
            <script>
                console.error("Error: {str(e)}");
                window.location.href = '/chat';
            </script>
            """,
            status_code=500
        )
