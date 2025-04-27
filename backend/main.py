from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
from dotenv import load_dotenv

import uvicorn

# Load environment variables from .env file
load_dotenv()

from app.database import engine, Base
from app.routes import auth_router, chat_router, group_router, ai_routes
from app.websockets import handle_websocket

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(title="MeowChat")

# Configure static files
static_path = Path("../frontend/static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# Include auth router which contains root routes for pages
app.include_router(auth_router)

# First, extract the chat page route to add directly to the app
chat_page_route = None
for route in chat_router.routes:
    if route.path == "/chat":
        chat_page_route = route
        break

# Filter out the chat page route from chat_router
if chat_page_route:
    chat_router.routes = [r for r in chat_router.routes if r != chat_page_route]
    # Add the chat page route directly to the app
    app.routes.append(chat_page_route)

# Now include the API routes with prefixes - Changed from "/api" to "/api/chat"
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(group_router, prefix="/api/groups", tags=["groups"])
app.include_router(ai_routes.router, prefix="/api/ai", tags=["ai"])


# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await handle_websocket(websocket, user_id)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
    )
