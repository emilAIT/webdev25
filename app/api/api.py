from fastapi import APIRouter

from app.api.endpoints import auth, chats, pages, users, websocket

api_router = APIRouter()

# Include routers from endpoint modules
api_router.include_router(auth.router, tags=["authentication"])
api_router.include_router(chats.router, prefix="/api/chats", tags=["chats"])
api_router.include_router(users.router, prefix="/api/users", tags=["users"])
api_router.include_router(pages.router, tags=["pages"])
api_router.include_router(websocket.router, prefix="/api/ws", tags=["websocket"])
api_router.include_router(pages.router, tags=["pages"])

