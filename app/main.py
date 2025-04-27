from fastapi import FastAPI
from app.routers import auth, chat, websockets, sendAttach, sendAudio

app = FastAPI()

# Include routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(websockets.router)
app.include_router(sendAttach.router)
app.include_router(sendAudio.router) 