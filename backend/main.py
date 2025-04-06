from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from .auth import router as auth_router
from .chat import router as chat_router, get_current_user
from .database import engine, Base, SessionLocal
from .models import Message
import socketio
from datetime import datetime

app = FastAPI()

# Create database tables
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
    print(f"Received message from {sid}: {data}")
    db = SessionLocal()
    try:
        # Validate required fields
        if not all(key in data for key in ["conversation_id", "sender_id", "content"]):
            print(f"Error: Missing required fields in message data: {data}")
            return

        new_message = Message(
            conversation_id=int(data["conversation_id"]),
            sender_id=int(data["sender_id"]),
            content=data["content"],
            timestamp=datetime.utcnow(),
        )
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        print(
            f"Message saved to database: ID={new_message.id}, Content={new_message.content}, ConversationID={new_message.conversation_id}"
        )

        # Prepare the message data to broadcast
        message_data = {
            "conversation_id": new_message.conversation_id,
            "sender_id": new_message.sender_id,
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
        }
        await sio.emit("message", message_data, room=str(data["conversation_id"]))
        print(f"Message broadcasted to room {data['conversation_id']}: {message_data}")

        # Emit an event to update the chat list
        await sio.emit(
            "update_chat_list",
            {"conversation_id": new_message.conversation_id},
            room=str(data["conversation_id"]),
        )
        print(
            f"Emitted update_chat_list event for conversation {new_message.conversation_id}"
        )
    except Exception as e:
        print(f"Error saving message to database: {e}")
        db.rollback()
    finally:
        db.close()


@sio.event
async def join_conversation(sid, data):
    conversation_id = data["conversation_id"]
    sio.enter_room(sid, str(conversation_id))
    print(f"Client {sid} joined conversation {conversation_id}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
