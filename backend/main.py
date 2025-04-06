from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .auth import router as auth_router
from .chat import router as chat_router
from .database import engine, Base
import socketio

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(chat_router)

app.mount("/static", StaticFiles(directory="static"), name="static")

sio = socketio.AsyncServer(async_mode="asgi")
socket_app = socketio.ASGIApp(sio, app)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.event
async def message(sid, data):
    await sio.emit("message", data, room=data["conversation_id"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
