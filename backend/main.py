from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from .auth import router as auth_router, SECRET_KEY, ALGORITHM
from .chat import router as chat_router, get_current_user
from .database import engine, Base, SessionLocal
from .models import Message, User
import socketio
from datetime import datetime
from jose import JWTError, jwt

app = FastAPI()

# Create database tables
Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(chat_router)

app.mount("/static", StaticFiles(directory="static"), name="static")

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio, app)

# Store user socket mappings
connected_users = {}


@sio.event
async def connect(sid, environ):
    token = environ.get("HTTP_AUTHORIZATION", "").replace("Bearer ", "")
    if not token:
        # Try to get token from auth parameter
        auth = environ.get("QUERY_STRING", "").split("&")
        for param in auth:
            if param.startswith("token="):
                token = param.split("=")[1]
                break

    if not token:
        await sio.disconnect(sid)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await sio.disconnect(sid)
            return

        # Get user from database
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                await sio.disconnect(sid)
                return

            # Store user connection
            connected_users[sid] = user.id
            print(
                f"User {user.username} (ID: {user.id}) connected with socket ID: {sid}"
            )

            # Join user to their conversations
            conversations = (
                db.query(Message.conversation_id)
                .filter(Message.sender_id == user.id)
                .distinct()
                .all()
            )

            for conv in conversations:
                await sio.enter_room(sid, str(conv.conversation_id))
                print(f"User {user.username} joined room {conv.conversation_id}")

        finally:
            db.close()

    except JWTError:
        await sio.disconnect(sid)
        return

    print(f"Client authenticated and connected: {sid}")


@sio.event
async def disconnect(sid):
    if sid in connected_users:
        print(f"User ID {connected_users[sid]} disconnected: {sid}")
        del connected_users[sid]
    else:
        print(f"Unknown client disconnected: {sid}")


@sio.event
async def message(sid, data):
    print(f"Received message from {sid}: {data}")

    # Check if user is authenticated
    if sid not in connected_users:
        print(f"Unauthorized message attempt from {sid}")
        return

    db = SessionLocal()
    try:
        # Validate required fields
        if not all(key in data for key in ["conversation_id", "sender_id", "content"]):
            print(f"Error: Missing required fields in message data: {data}")
            return

        # Verify the sender_id matches the connected user
        if int(data["sender_id"]) != connected_users[sid]:
            print(
                f"Error: User {connected_users[sid]} attempting to send message as user {data['sender_id']}"
            )
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
            "id": new_message.id,
            "conversation_id": new_message.conversation_id,
            "sender_id": new_message.sender_id,
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
        }

        # Broadcast to everyone in the conversation room
        await sio.emit("message", message_data, room=str(data["conversation_id"]))
        print(f"Message broadcasted to room {data['conversation_id']}: {message_data}")

        # Emit an event to update the chat list for everyone
        await sio.emit(
            "update_chat_list",
            {"conversation_id": new_message.conversation_id},
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
    if sid not in connected_users:
        print(f"Unauthorized join attempt from {sid}")
        return

    conversation_id = data["conversation_id"]
    await sio.enter_room(sid, str(conversation_id))
    print(
        f"Client {sid} (User ID {connected_users[sid]}) joined conversation {conversation_id}"
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
