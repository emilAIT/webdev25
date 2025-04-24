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

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    async_handlers=True,
    ping_timeout=35000,
    logger=True,
    engineio_logger=True,
)

# Add CORS middleware
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

socket_app = socketio.ASGIApp(sio, app)

# Store user socket mappings
connected_users = {}


@sio.event
async def connect(sid, environ, auth=None):
    try:
        token = None

        # Try to get token from auth data first
        if auth and isinstance(auth, dict):
            token = auth.get("token")

        # Try to get token from query string
        if not token:
            query = environ.get("QUERY_STRING", "")
            for param in query.split("&"):
                if param.startswith("token="):
                    token = param.split("=")[1]
                    break

        # Try to get token from headers
        if not token:
            headers = environ.get("HTTP_AUTHORIZATION", "")
            if headers.startswith("Bearer "):
                token = headers.split(" ")[1]

        if not token:
            print("No token found in connection request")
            await sio.disconnect(sid)
            return False

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if not username:
                raise JWTError("Invalid token payload")

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.username == username).first()
                if not user:
                    raise JWTError("User not found")

                # Store user connection
                connected_users[sid] = user.id
                print(
                    f"User {user.username} (ID: {user.id}) connected with socket ID: {sid}"
                )

                # Join user's conversations
                conversations = (
                    db.query(Message.conversation_id)
                    .filter(Message.sender_id == user.id)
                    .distinct()
                    .all()
                )

                for conv in conversations:
                    await sio.enter_room(sid, str(conv.conversation_id))
                    print(f"User {user.username} joined room {conv.conversation_id}")

                return True

            finally:
                db.close()

        except JWTError as e:
            print(f"Token validation failed: {str(e)}")
            await sio.disconnect(sid)
            return False

    except Exception as e:
        print(f"Connection error: {str(e)}")
        await sio.disconnect(sid)
        return False

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

        # Create the new message with optional reply_to reference
        new_message = Message(
            conversation_id=int(data["conversation_id"]),
            sender_id=int(data["sender_id"]),
            content=data["content"],
            timestamp=datetime.utcnow(),
            replied_to_id=data.get("replied_to_id"),
        )

        db.add(new_message)
        db.commit()
        db.refresh(new_message)

        # Prepare the message data to broadcast
        message_data = {
            "id": new_message.id,
            "conversation_id": new_message.conversation_id,
            "sender_id": new_message.sender_id,
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
            "replied_to_id": new_message.replied_to_id,
            "is_deleted": False,
        }

        # Add reply info if this is a reply
        if new_message.replied_to_id:
            replied_msg = (
                db.query(Message)
                .filter(Message.id == new_message.replied_to_id)
                .first()
            )
            if replied_msg:
                message_data["replied_to_content"] = (
                    replied_msg.content
                    if not replied_msg.is_deleted
                    else "[Message deleted]"
                )
                message_data["replied_to_sender"] = replied_msg.sender_id

        # Broadcast to everyone in the conversation room
        await sio.emit("message", message_data, room=str(data["conversation_id"]))

        # Emit an event to update the chat list for everyone
        await sio.emit(
            "update_chat_list",
            {"conversation_id": new_message.conversation_id},
        )
    except Exception as e:
        print(f"Error saving message to database: {e}")
        db.rollback()
    finally:
        db.close()


# Add message deletion handler for WebSocket
@sio.event
async def delete_message(sid, data):
    if sid not in connected_users:
        print(f"Unauthorized delete attempt from {sid}")
        return

    user_id = connected_users[sid]
    message_id = data.get("message_id")

    if not message_id:
        print("No message_id provided")
        return

    db = SessionLocal()
    try:
        message = db.query(Message).filter(Message.id == message_id).first()

        if not message:
            print(f"Message {message_id} not found")
            return

        if message.sender_id != user_id:
            print(f"User {user_id} not authorized to delete message {message_id}")
            return

        message.is_deleted = True
        db.commit()

        # Notify clients about deleted message
        await sio.emit(
            "message_deleted",
            {"message_id": message_id, "conversation_id": message.conversation_id},
            room=str(message.conversation_id),
        )

    except Exception as e:
        print(f"Error deleting message: {e}")
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


@sio.event
async def leave_room(sid, data):
    if sid not in connected_users:
        print(f"Unauthorized leave attempt from {sid}")
        return

    conversation_id = data["conversation_id"]
    await sio.leave_room(sid, str(conversation_id))
    print(
        f"Client {sid} (User ID {connected_users[sid]}) left conversation {conversation_id}"
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
