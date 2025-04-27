# Routes package initialization

from .auth_routes import router as auth_router
from .chat_routes import router as chat_router
from .group_routes import router as group_router

__all__ = ["auth_router", "chat_router", "group_router"]
