from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from .auth import router as auth_router
from .chat import router as chat_router, get_current_user
from .database import engine, Base, SessionLocal
from .models import Message
import socketio
from datetime import datetime

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(chat_router)

app.mount("/static", StaticFiles(directory="static"), name="static")

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio, app)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.event
async def message(sid, data):
    print(f"Received message: {data}")
    db = SessionLocal()
    try:
        new_message = Message(
            conversation_id=data["conversation_id"],
            sender_id=data["sender_id"],
            content=data["content"],
            timestamp=datetime.utcnow(),
        )
        db.add(new_message)
        db.commit()
        print(f"Message saved to database: {new_message.id}")
    finally:
        db.close()
    await sio.emit("message", data, room=str(data["conversation_id"]))
    print(f"Message broadcasted to room {data['conversation_id']}")


@sio.event
async def join_conversation(sid, data):
    conversation_id = data["conversation_id"]
    sio.enter_room(sid, str(conversation_id))
    print(f"Client {sid} joined conversation {conversation_id}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
