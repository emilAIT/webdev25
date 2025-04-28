from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from .auth import router as auth_router, SECRET_KEY, ALGORITHM
from .chat import router as chat_router
from .ai_routes import router as ai_router

# --- ADD THIS: Import Call model ---
from .database import engine, Base, SessionLocal
from .models import Message, User, ConversationParticipant, Call
from .ws_manager import sio, connected_users
import socketio
from datetime import datetime
from jose import JWTError, jwt
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Create database tables
Base.metadata.create_all(bind=engine)

# Add CORS middleware (Place middleware setup early)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You might want to restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(ai_router)


# Mount Static Files (Typically after routers)
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Socket.IO Setup ---
# Wrap the FastAPI app with the Socket.IO ASGIApp
# Make sure this is done *after* all routes and middleware are added to 'app'
socket_app = socketio.ASGIApp(sio, app)


# --- Helper to find SID by User ID ---
def get_sid_by_user_id(user_id):
    for sid, uid in connected_users.items():
        if uid == user_id:
            return sid
    return None


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

        # Try to get token from headers (Authorization: Bearer <token>)
        if not token:
            headers = environ.get("HTTP_AUTHORIZATION", "")
            if headers and headers.lower().startswith("bearer "):
                token = headers.split(" ")[1]

        if not token:
            print(f"Connection attempt from {sid} failed: No token found.")
            await sio.disconnect(sid)
            return False  # Explicitly return False for failed connection

        # Validate token and get user
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if not username:
                raise JWTError("Invalid token payload: Missing 'sub'")

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.username == username).first()
                if not user:
                    # Avoid revealing specific errors like "User not found" to client
                    raise JWTError("Invalid token: User validation failed")

                # Store user connection AFTER successful validation
                connected_users[sid] = user.id
                print(
                    f"User {user.username} (ID: {user.id}) connected with socket ID: {sid}"
                )

                # Join user's conversations
                conversations = (
                    db.query(ConversationParticipant)
                    .filter(ConversationParticipant.user_id == user.id)
                    .all()
                )
                for conv_participant in conversations:
                    room_name = str(conv_participant.conversation_id)
                    await sio.enter_room(sid, room_name)
                    print(f"User {user.username} (sid: {sid}) joined room {room_name}")

                # Connection successful
                return True  # Indicate successful connection

            except (
                Exception
            ) as db_err:  # Catch potential DB errors during user/conv lookup
                print(f"Database error during connection for {sid}: {db_err}")
                await sio.disconnect(sid)
                return False
            finally:
                db.close()

        except JWTError as e:
            print(f"Token validation failed for {sid}: {str(e)}")
            await sio.disconnect(sid)
            return False  # Indicate failed connection

    except Exception as e:
        # Catch-all for unexpected errors during connect logic
        print(f"Unexpected connection error for {sid}: {str(e)}")
        # Ensure disconnect is attempted even on unexpected errors
        try:
            await sio.disconnect(sid)
        except Exception as disconnect_err:
            print(
                f"Error during disconnect attempt for {sid} after connection error: {disconnect_err}"
            )
        return False  # Indicate failed connection


@sio.event
async def disconnect(sid):
    if sid in connected_users:
        user_id = connected_users[sid]
        print(f"User ID {user_id} disconnected: {sid}")
        # Clean up user from connected_users map
        del connected_users[sid]
        # Optionally, you might want to leave all rooms, though Socket.IO handles this
    else:
        print(f"Unknown client disconnected: {sid}")


@sio.event
async def message(sid, data):
    print(f"Received message from {sid}: {data}")

    # 1. Check if user is authenticated
    if sid not in connected_users:
        print(f"Unauthorized message attempt from {sid}")
        # Optionally send an error back to the specific client
        # await sio.emit('error', {'message': 'Authentication required'}, room=sid)
        return  # Stop processing

    user_id = connected_users[sid]

    # 2. Validate incoming data
    if not isinstance(data, dict):
        print(
            f"Invalid message data format from {sid}: Expected dict, got {type(data)}"
        )
        return

    conversation_id = data.get("conversation_id")
    sender_id_from_data = data.get("sender_id")
    content = data.get("content")
    replied_to_id = data.get("replied_to_id")  # Optional

    # Check for required fields
    if not conversation_id or sender_id_from_data is None or content is None:
        print(f"Error: Missing required fields in message data from {sid}: {data}")
        # Optionally send an error back
        # await sio.emit('error', {'message': 'Missing required message fields'}, room=sid)
        return

    # 3. Verify sender ID matches the authenticated user
    try:
        # Ensure IDs are compared as the same type (e.g., int)
        if int(sender_id_from_data) != user_id:
            print(
                f"Error: User {user_id} (sid: {sid}) attempting to send message as user {sender_id_from_data}"
            )
            # Optionally send an error back
            # await sio.emit('error', {'message': 'Sender ID mismatch'}, room=sid)
            return
    except (ValueError, TypeError):
        print(f"Error: Invalid sender_id format from {sid}: {sender_id_from_data}")
        return

    # 4. Basic Content Validation (Example)
    if not isinstance(content, str) or not content.strip():
        print(f"Error: Invalid or empty message content from {sid}")
        # await sio.emit('error', {'message': 'Message content cannot be empty'}, room=sid)
        return
    # You might add length limits, sanitization, etc. here

    # 5. Process and save the message
    db = SessionLocal()
    try:
        # Create the new message
        new_message = Message(
            conversation_id=int(conversation_id),  # Ensure type consistency
            sender_id=user_id,  # Use the authenticated user_id
            content=content.strip(),  # Trim whitespace
            timestamp=datetime.utcnow(),
            replied_to_id=(
                int(replied_to_id) if replied_to_id is not None else None
            ),  # Ensure type consistency
        )

        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        print(f"Message {new_message.id} saved for conversation {conversation_id}")

        # 6. Prepare the message data to broadcast (Include sender username)
        # Fetch sender username for broadcast payload
        sender_username = (
            db.query(User.username).filter(User.id == user_id).scalar() or "Unknown"
        )

        message_data = {
            "id": new_message.id,
            "conversation_id": new_message.conversation_id,
            "sender_id": new_message.sender_id,
            "sender_username": sender_username,  # Add username
            "content": new_message.content,
            "timestamp": new_message.timestamp.isoformat(),
            "replied_to_id": new_message.replied_to_id,
            "is_deleted": False,  # New messages are not deleted
            "read_at": None,  # New messages are not read yet
        }

        # Add reply info if this is a reply
        if new_message.replied_to_id:
            # Query replied message and its sender's username in one go
            replied_info = (
                db.query(
                    Message.content,
                    Message.sender_id,
                    Message.is_deleted,
                    User.username,
                )
                .join(User, Message.sender_id == User.id)
                .filter(Message.id == new_message.replied_to_id)
                .first()
            )

            if replied_info:
                (
                    replied_content,
                    replied_sender_id,
                    replied_is_deleted,
                    replied_username,
                ) = replied_info
                message_data["replied_to_content"] = (
                    replied_content if not replied_is_deleted else "[Message deleted]"
                )
                message_data["replied_to_sender"] = replied_sender_id
                message_data["replied_to_username"] = (
                    replied_username  # Add replied username
                )

        # 7. Broadcast to the conversation room
        room_name = str(conversation_id)
        await sio.emit("message", message_data, room=room_name)
        print(f"Message {new_message.id} broadcasted to room {room_name}")

        # 8. Emit an event to update the chat list for relevant users (more targeted approach needed)
        # Finding all participants and their SIDs can be inefficient here.
        # A better approach might be for clients to request updates or use the 'message' event
        # itself to trigger a fetch of conversations if needed.
        # For simplicity, keeping the broad emit for now:
        # await sio.emit(
        #     "update_chat_list",
        #     {"conversation_id": new_message.conversation_id},
        # )

    except Exception as e:
        print(f"Error processing message from {sid}: {e}")
        db.rollback()
        # Optionally notify the sender of the error
        # await sio.emit('error', {'message': 'Failed to send message'}, room=sid)
    finally:
        db.close()


# --- Message Deletion via WebSocket ---
@sio.event
async def delete_message(sid, data):
    if sid not in connected_users:
        print(f"Unauthorized delete attempt from {sid}")
        return

    user_id = connected_users[sid]

    if not isinstance(data, dict):
        print(f"Invalid delete_message data format from {sid}")
        return

    message_id = data.get("message_id")

    if not message_id:
        print(f"No message_id provided for delete by {sid}")
        return

    try:
        message_id = int(message_id)  # Ensure integer ID
    except (ValueError, TypeError):
        print(f"Invalid message_id format for delete from {sid}: {message_id}")
        return

    db = SessionLocal()
    try:
        # Fetch the message to be deleted
        message = db.query(Message).filter(Message.id == message_id).first()

        if not message:
            print(f"Delete attempt by {sid}: Message {message_id} not found")
            # No need to broadcast if message doesn't exist
            return

        # Verify ownership
        if message.sender_id != user_id:
            print(
                f"Authorization error: User {user_id} (sid: {sid}) cannot delete message {message_id} owned by {message.sender_id}"
            )
            # await sio.emit('error', {'message': 'Not authorized to delete this message'}, room=sid)
            return

        # Check if already deleted
        if message.is_deleted:
            print(f"Message {message_id} already deleted. No action taken.")
            return

        # Mark as deleted
        message.is_deleted = True
        db.commit()
        print(f"Message {message_id} marked as deleted by user {user_id} (sid: {sid})")

        # Notify clients in the conversation room
        room_name = str(message.conversation_id)
        await sio.emit(
            "message_deleted",
            {"message_id": message_id, "conversation_id": message.conversation_id},
            room=room_name,
        )
        print(f"Delete notification for message {message_id} sent to room {room_name}")

    except Exception as e:
        print(f"Error deleting message {message_id} requested by {sid}: {e}")
        db.rollback()
        # await sio.emit('error', {'message': 'Failed to delete message'}, room=sid)
    finally:
        db.close()


# --- Message Editing via WebSocket ---
@sio.event
async def edit_message(sid, data):
    if sid not in connected_users:
        print(f"Unauthorized edit attempt from {sid}")
        return

    user_id = connected_users[sid]

    if not isinstance(data, dict):
        print(f"Invalid edit_message data format from {sid}")
        return

    message_id = data.get("message_id")
    new_content = data.get("content")

    # Validate input
    if (
        not message_id or new_content is None
    ):  # Allow empty string for content, but not None
        print(f"Missing message_id or content for edit from {sid}")
        return

    if not isinstance(new_content, str) or not new_content.strip():
        print(f"Error: Invalid or empty new content for edit from {sid}")
        # await sio.emit('error', {'message': 'Edited message content cannot be empty'}, room=sid)
        return

    try:
        message_id = int(message_id)
    except (ValueError, TypeError):
        print(f"Invalid message_id format for edit from {sid}: {message_id}")
        return

    db = SessionLocal()
    try:
        # Fetch the message
        message = db.query(Message).filter(Message.id == message_id).first()

        if not message:
            print(f"Edit attempt by {sid}: Message {message_id} not found")
            return

        # Verify ownership
        if message.sender_id != user_id:
            print(
                f"Authorization error: User {user_id} (sid: {sid}) cannot edit message {message_id} owned by {message.sender_id}"
            )
            # await sio.emit('error', {'message': 'Not authorized to edit this message'}, room=sid)
            return

        # Check if deleted
        if message.is_deleted:
            print(f"Edit attempt by {sid}: Cannot edit deleted message {message_id}")
            # await sio.emit('error', {'message': 'Cannot edit a deleted message'}, room=sid)
            return

        # Check if content actually changed
        if message.content == new_content.strip():
            print(
                f"Edit attempt by {sid}: Content for message {message_id} is unchanged. No action taken."
            )
            return

        # Update content
        message.content = new_content.strip()
        db.commit()
        print(f"Message {message_id} edited by user {user_id} (sid: {sid})")

        # Notify clients in the room
        room_name = str(message.conversation_id)
        await sio.emit(
            "message_edited",
            {
                "message_id": message_id,
                "content": message.content,  # Send the updated content
                "conversation_id": message.conversation_id,
            },
            room=room_name,
        )
        print(f"Edit notification for message {message_id} sent to room {room_name}")

    except Exception as e:
        print(f"Error editing message {message_id} requested by {sid}: {e}")
        db.rollback()
        # await sio.emit('error', {'message': 'Failed to edit message'}, room=sid)
    finally:
        db.close()


# --- Room Management (Optional but good practice) ---
@sio.event
async def join_conversation(sid, data):
    if sid not in connected_users:
        print(f"Unauthorized join attempt from {sid}")
        return

    if not isinstance(data, dict) or "conversation_id" not in data:
        print(f"Invalid join_conversation data from {sid}")
        return

    conversation_id = data["conversation_id"]
    room_name = str(conversation_id)
    await sio.enter_room(sid, room_name)
    print(
        f"Client {sid} (User ID {connected_users[sid]}) explicitly joined room {room_name}"
    )
    # You might add logic here to verify the user *should* be in this room based on DB


@sio.event
async def leave_conversation(sid, data):  # Renamed for clarity
    # Note: Socket.IO handles leaving rooms on disconnect automatically.
    # This is useful if a user explicitly leaves a chat window without disconnecting.
    if sid not in connected_users:
        print(f"Unauthorized leave attempt from {sid}")
        return

    if not isinstance(data, dict) or "conversation_id" not in data:
        print(f"Invalid leave_conversation data from {sid}")
        return

    conversation_id = data["conversation_id"]
    room_name = str(conversation_id)
    await sio.leave_room(sid, room_name)
    print(
        f"Client {sid} (User ID {connected_users[sid]}) explicitly left room {room_name}"
    )


# --- WebRTC Signaling Handlers ---


@sio.event
async def call_request(sid, data):
    if sid not in connected_users:
        return print(f"Unauthorized call_request from {sid}")

    caller_id = connected_users[sid]
    callee_id = data.get("callee_id")
    if not callee_id:
        return print(f"call_request from {sid} missing callee_id")

    callee_sid = get_sid_by_user_id(callee_id)
    if not callee_sid:
        print(f"User {callee_id} not online for call request from {caller_id}")
        await sio.emit("call_unavailable", {"callee_id": callee_id}, room=sid)
        return

    db = SessionLocal()
    try:
        caller = db.query(User).filter(User.id == caller_id).first()
        callee = db.query(User).filter(User.id == callee_id).first()
        if not caller or not callee:
            raise Exception("Caller or Callee not found in DB")

        # Create a call record
        new_call = Call(caller_id=caller_id, callee_id=callee_id, status="initiated")
        db.add(new_call)
        db.commit()
        db.refresh(new_call)

        print(
            f"Relaying call request from {caller.username} ({sid}) to {callee.username} ({callee_sid})"
        )
        await sio.emit(
            "incoming_call",
            {
                "caller_id": caller_id,
                "caller_username": caller.username,
                "call_id": new_call.id,  # Include call ID
            },
            room=callee_sid,
        )
    except Exception as e:
        print(f"Error processing call_request from {sid}: {e}")
        db.rollback()
        await sio.emit("call_error", {"message": "Failed to initiate call"}, room=sid)
    finally:
        db.close()


@sio.event
async def call_response(sid, data):
    if sid not in connected_users:
        return print(f"Unauthorized call_response from {sid}")

    callee_id = connected_users[sid]
    caller_id = data.get("caller_id")
    response = data.get("response")  # 'accepted' or 'rejected'
    call_id = data.get("call_id")

    if not caller_id or not response or not call_id:
        return print(f"call_response from {sid} missing data")

    caller_sid = get_sid_by_user_id(caller_id)
    if not caller_sid:
        print(f"Caller {caller_id} not online for call response from {callee_id}")
        # Optionally update call status in DB to 'missed' or similar
        return

    db = SessionLocal()
    try:
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call or call.callee_id != callee_id or call.caller_id != caller_id:
            raise Exception("Invalid call record for response")

        call.status = response  # Update status to 'accepted' or 'rejected'
        if response == "rejected":
            call.end_time = datetime.utcnow()
        db.commit()

        print(
            f"Relaying call response '{response}' from {callee_id} to {caller_id} ({caller_sid})"
        )
        await sio.emit(
            "call_response",
            {"callee_id": callee_id, "response": response, "call_id": call_id},
            room=caller_sid,
        )
    except Exception as e:
        print(f"Error processing call_response from {sid}: {e}")
        db.rollback()
        # Notify both parties of error?
    finally:
        db.close()


@sio.event
async def webrtc_signal(sid, data):
    if sid not in connected_users:
        return print(f"Unauthorized webrtc_signal from {sid}")

    sender_id = connected_users[sid]
    target_id = data.get("target_id")
    signal_type = data.get("type")  # 'offer', 'answer', 'ice-candidate'
    signal_data = data.get("data")

    if not target_id or not signal_type or signal_data is None:
        return print(f"webrtc_signal from {sid} missing data")

    target_sid = get_sid_by_user_id(target_id)
    if not target_sid:
        print(f"Target user {target_id} not online for WebRTC signal from {sender_id}")
        # Maybe notify sender that target is offline?
        return

    print(
        f"Relaying WebRTC signal '{signal_type}' from {sender_id} ({sid}) to {target_id} ({target_sid})"
    )
    await sio.emit(
        "webrtc_signal",
        {
            "sender_id": sender_id,
            "type": signal_type,
            "data": signal_data,
        },
        room=target_sid,
    )


@sio.event
async def hang_up(sid, data):
    if sid not in connected_users:
        return print(f"Unauthorized hang_up from {sid}")

    user_id = connected_users[sid]
    target_id = data.get("target_id")  # The other user in the call
    call_id = data.get("call_id")

    if not target_id or not call_id:
        return print(f"hang_up from {sid} missing target_id or call_id")

    target_sid = get_sid_by_user_id(target_id)

    db = SessionLocal()
    try:
        call = db.query(Call).filter(Call.id == call_id).first()
        if call and call.status not in ["ended", "rejected", "missed"]:
            # Ensure the user hanging up is part of the call
            if call.caller_id == user_id or call.callee_id == user_id:
                call.status = "ended"
                call.end_time = datetime.utcnow()
                db.commit()
                print(f"Call {call_id} ended by user {user_id}")

                # Notify the other user if they are online
                if target_sid:
                    print(f"Notifying user {target_id} ({target_sid}) of hang_up")
                    await sio.emit(
                        "call_ended",
                        {"call_id": call_id, "ended_by": user_id},
                        room=target_sid,
                    )
            else:
                print(
                    f"User {user_id} tried to hang up call {call_id} they are not part of."
                )
        elif call:
            print(f"Call {call_id} already ended/rejected/missed.")
        else:
            print(f"Call {call_id} not found for hang_up by user {user_id}")

    except Exception as e:
        print(f"Error processing hang_up for call {call_id} from {sid}: {e}")
        db.rollback()
    finally:
        db.close()


# --- Main Execution ---
if __name__ == "__main__":
    import uvicorn

    # Use socket_app here, which wraps the FastAPI app
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
