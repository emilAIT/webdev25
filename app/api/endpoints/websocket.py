import sqlite3
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import Dict, List, Set, Tuple
import json
import traceback
import time

from app.core.auth import get_current_user_from_token
from app.db.chat_crud import get_chat, create_message
from app.db.user_crud import get_user_by_id
from app.core.config import logger
from app.models.schemas import MessageCreate
from app.db.database import get_db_connection

router = APIRouter()

# Store active connections by user ID and chat ID
# Format: {user_id: {chat_id: websocket}}
active_connections: Dict[int, Dict[int, WebSocket]] = {}

# Store chat participants for broadcasting
# Format: {chat_id: set(user_ids)}
chat_participants: Dict[int, Set[int]] = {}

# In-memory storage for video call signaling connections
videocall_connections: Dict[int, Set[WebSocket]] = {}

# Store pending call requests
# Format: {chat_id: (caller_id, callee_id, timestamp)}
pending_calls: Dict[int, Tuple[int, int, float]] = {}

@router.websocket("/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...)
):
    try:
        logger.info(f"WebSocket connection attempt for chat {chat_id}")
        
        # Authenticate user with token
        current_user = await get_current_user_from_token(token)
        if not current_user:
            logger.warning(f"WebSocket authentication failed for chat {chat_id}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
            return
            
        user_id = current_user["id"]
        logger.info(f"WebSocket authenticated for user {user_id} in chat {chat_id}")
        
        # Verify user is part of this chat or group chat
        from app.db.group_crud import get_group_by_id, get_group_members
        
        # First check if it's a direct chat
        chat = get_chat(chat_id, user_id)
        
        # If not a direct chat, check if it's a group chat
        is_group_chat = False
        if not chat:
            group = get_group_by_id(chat_id)
            if group:
                # Check if user is a member of this group
                members = get_group_members(chat_id)
                member_ids = [member["id"] for member in members]
                if user_id in member_ids:
                    is_group_chat = True
                else:
                    logger.warning(f"User {user_id} not authorized for group chat {chat_id}")
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not authorized for this group chat")
                    return
            else:
                logger.warning(f"User {user_id} not authorized for chat {chat_id} (neither direct nor group chat)")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not authorized for this chat")
                return
        
        # For direct chats, extract the other user ID
        other_user_ids = []
        if not is_group_chat:
            other_user_id = chat["user1_id"] if chat["user1_id"] != user_id else chat["user2_id"]
            other_user_ids = [other_user_id]
        else:
            # For group chats, get all other members
            members = get_group_members(chat_id)
            other_user_ids = [member["id"] for member in members if member["id"] != user_id]
        
        # Accept the connection
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for user {user_id} in chat {chat_id}")
        
        # Store the connection
        if user_id not in active_connections:
            active_connections[user_id] = {}
        active_connections[user_id][chat_id] = websocket
        
        # Store chat participants for broadcasting
        if chat_id not in chat_participants:
            if is_group_chat:
                # For group chats, initialize with all member IDs
                chat_participants[chat_id] = set([user_id] + other_user_ids)
            else:
                # For direct chats, just the two users
                other_user_id = other_user_ids[0] if other_user_ids else None
                chat_participants[chat_id] = {user_id, other_user_id} if other_user_id else {user_id}
        else:
            chat_participants[chat_id].add(user_id)
        
        # Send confirmation message
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "message": "Connected to chat websocket"
        }))
        
        # Main WebSocket loop
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                
                # Parse the message
                try:
                    message_data = json.loads(data)
                    message_type = message_data.get("type", "text")
                    
                    # Handle different types of messages
                    if message_type == "call_request":
                        # Handle call request
                        await handle_call_request(chat_id, user_id, current_user, websocket)
                    elif message_type == "call_answer":
                        # Handle call answer (accept/decline)
                        response = message_data.get("response")
                        await handle_call_answer(chat_id, user_id, response, websocket)
                    elif message_type == "call_cancel":
                        # Handle call cancellation
                        await handle_call_cancel(chat_id, user_id)
                    elif message_type == "edit_message":
                        # Handle message edit
                        message_id = message_data.get("message_id")
                        new_content = message_data.get("content")
                        
                        if not message_id or not new_content:
                            continue
                            
                        # Проверяем, существует ли сообщение и принадлежит ли оно пользователю
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute(
                            "SELECT * FROM messages WHERE id = ? AND sender_id = ?",
                            (message_id, current_user['id'])
                        )
                        message = cursor.fetchone()
                        conn.close()
                        
                        if not message:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": "Message not found or you don't have permission to edit it"
                            }))
                            continue
                            
                        # Update message in database
                        from app.api.endpoints.chats import edit_message
                        try:
                            # Создаем объект MessageCreate
                            message_update = MessageCreate(content=new_content)
                            
                            updated_message = await edit_message(
                                message_id=message_id,
                                message_update=message_update,
                                current_user=current_user
                            )
                            
                            # Проверяем, что updated_message содержит все необходимые поля
                            if not isinstance(updated_message, dict):
                                updated_message = dict(updated_message)
                            
                            # Broadcast edit to all participants
                            broadcast_data = {
                                "type": "message_edited",
                                "message": {
                                    "id": message_id,
                                    "content": new_content,
                                    "sender_id": current_user["id"],
                                    "sender_name": current_user["nickname"],
                                    "timestamp": updated_message.get("timestamp", ""),
                                    "is_sent_by_me": True
                                }
                            }
                            
                            message_json = json.dumps(broadcast_data)
                            for user_id in chat_participants[chat_id]:
                                if user_id in active_connections and chat_id in active_connections[user_id]:
                                    try:
                                        await active_connections[user_id][chat_id].send_text(message_json)
                                    except Exception as e:
                                        logger.error(f"Error broadcasting edit to user {user_id}: {str(e)}")
                                        
                        except Exception as e:
                            logger.error(f"Error editing message: {str(e)}")
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": "Failed to edit message"
                            }))
                            
                    elif message_type == "delete_message":
                        # Handle message deletion
                        message_id = message_data.get("message_id")
                        
                        if not message_id:
                            continue
                            
                        # Delete message from database
                        from app.api.endpoints.chats import delete_message
                        try:
                            # Проверяем, существует ли сообщение и принадлежит ли оно пользователю
                            conn = get_db_connection()
                            cursor = conn.cursor()
                            cursor.execute(
                                "SELECT * FROM messages WHERE id = ? AND sender_id = ?",
                                (message_id, current_user['id'])
                            )
                            message = cursor.fetchone()
                            conn.close()
                            
                            if not message:
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "message": "Message not found or you don't have permission to delete it"
                                }))
                                continue
                            
                            # Удаляем сообщение
                            await delete_message(
                                message_id=message_id,
                                current_user=current_user
                            )
                            
                            # Broadcast deletion to all participants
                            broadcast_data = {
                                "type": "message_deleted",
                                "message_id": message_id
                            }
                            
                            message_json = json.dumps(broadcast_data)
                            for user_id in chat_participants[chat_id]:
                                if user_id in active_connections and chat_id in active_connections[user_id]:
                                    try:
                                        await active_connections[user_id][chat_id].send_text(message_json)
                                    except Exception as e:
                                        logger.error(f"Error broadcasting deletion to user {user_id}: {str(e)}")
                                        
                        except Exception as e:
                            logger.error(f"Error deleting message: {str(e)}")
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": "Failed to delete message"
                            }))
                    else:
                        # Regular text message
                        message_content = message_data.get("content")
                        
                        if not message_content or not message_content.strip():
                            continue
                        
                        # Save message to database - handle differently for group chats
                        db_message = None
                        
                        # Check if this is a group chat
                        from app.db.group_crud import add_group_message, get_group_by_id
                        group = get_group_by_id(chat_id)
                        
                        if group:
                            # It's a group chat
                            db_message = add_group_message(chat_id, user_id, message_content)
                        else:
                            # It's a direct chat
                            db_message = create_message(chat_id, user_id, message_content)
                        
                        if db_message:
                            # Broadcast message to all participants in chat
                            await broadcast_message(chat_id, user_id, db_message)
                    
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Invalid message format"
                    }))
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {user_id} in chat {chat_id}")
            # Ensure cleanup on disconnection
            if user_id in active_connections and chat_id in active_connections[user_id]:
                del active_connections[user_id][chat_id]
                if not active_connections[user_id]:  # If no more chats for this user
                    del active_connections[user_id]
            
            if chat_id in chat_participants:
                chat_participants[chat_id].discard(user_id)
                if not chat_participants[chat_id]:  # If no more participants in this chat
                    del chat_participants[chat_id]
    
    except Exception as e:
        # Handle any other exceptions
        error_details = traceback.format_exc()
        logger.error(f"WebSocket error: {str(e)}\n{error_details}")
        try:
            if websocket.client_state.CONNECTED:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=f"Internal server error")
        except:
            pass


async def broadcast_message(chat_id: int, sender_id: int, message: dict):
    """Broadcast message to all participants in a chat"""
    if chat_id not in chat_participants:
        return
    
    # Add chat_id to the message for client-side filtering
    message["chat_id"] = chat_id
    
    # Format message for broadcasting
    broadcast_data = {
        "type": "new_message",
        "message": message
    }
    
    message_json = json.dumps(broadcast_data)
    
    # Send to all participants except sender
    for user_id in chat_participants[chat_id]:
        if user_id != sender_id and user_id in active_connections and chat_id in active_connections[user_id]:
            try:
                await active_connections[user_id][chat_id].send_text(message_json)
            except Exception as e:
                logger.error(f"Error broadcasting to user {user_id}: {str(e)}")


@router.websocket("/videocall/{chat_id}")
async def videocall_signaling(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...)
):
    """WebSocket endpoint for WebRTC signaling in video calls"""
    # Accept the WebSocket handshake
    await websocket.accept()
    # Authenticate user
    current_user = await get_current_user_from_token(token)
    if not current_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
        return

    # Verify chat membership
    chat = get_chat(chat_id, current_user["id"])
    if not chat:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not in chat")
        return
    
    # Check if this chat_id is in pending calls and if it matches the accepted call
    if chat_id not in pending_calls and chat_id != 0:  # chat_id 0 is allowed for direct calls without notification
        logger.warning(f"User {current_user['id']} attempting to join video call for chat {chat_id} with no pending call")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "No active call found"
        }))
        # Don't disconnect them yet, as the other peer might not have connected
    
    if chat_id not in videocall_connections:
        videocall_connections[chat_id] = set()
    videocall_connections[chat_id].add(websocket)

    # Acknowledge connection
    await websocket.send_text(json.dumps({
        "type": "call_joined",
        "message": "Joined call session"
    }))

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            # Special handling for call termination
            if msg.get("type") == "call_end":
                logger.info(f"Call ended by user {current_user['id']} in chat {chat_id}")
                # Relay end message to all peers
                for peer in list(videocall_connections[chat_id]):
                    if peer != websocket:
                        await peer.send_text(json.dumps({
                            "type": "call_end",
                            "message": "Call ended by other participant"
                        }))
                break
            
            # Relay signaling message to other peer(s)
            for peer in list(videocall_connections[chat_id]):
                if peer != websocket:
                    await peer.send_text(json.dumps(msg))

    except WebSocketDisconnect:
        logger.info(f"Video call WebSocket disconnected for user {current_user['id']} in chat {chat_id}")
    except Exception as e:
        logger.error(f"Error in video call: {str(e)}")
    finally:
        # Clean up on disconnect
        videocall_connections[chat_id].discard(websocket)
        if not videocall_connections[chat_id]:
            del videocall_connections[chat_id]
            # If this was a pending call, clear it
            if chat_id in pending_calls:
                del pending_calls[chat_id]


async def handle_call_request(chat_id: int, caller_id: int, caller_user: sqlite3.Row, caller_websocket: WebSocket):
    """Handle an incoming video call request"""
    logger.info(f"Call request from user {caller_id} in chat {chat_id}")
    
    # FIXED: Don't try to get user details separately, just use the caller_user parameter
    
    if chat_id not in chat_participants:
        await caller_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "Chat not found or no participants"
        }))
        return
    
    # Find the other participant (callee)
    callee_id = None
    for user_id in chat_participants[chat_id]:
        if user_id != caller_id:
            callee_id = user_id
            break
    
    if not callee_id:
        await caller_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "No recipient found for call"
        }))
        return
    
    # Check if callee is connected
    if callee_id not in active_connections or chat_id not in active_connections[callee_id]:
        await caller_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "Recipient is not online"
        }))
        return
    
    # Store the pending call
    pending_calls[chat_id] = (caller_id, callee_id, time.time())
    
    # Get caller's details to show in the notification
    callee_websocket = active_connections[callee_id][chat_id]
    
    # Send call notification to callee
    try:
        # FIXED: Access safely from the caller_user parameter and provide defaults
        # caller_user comes from the authenticated token and should be valid
        print(f"Caller user: {caller_id}")
        await callee_websocket.send_text(json.dumps({
            "type": "incoming_call",
            "chat_id": chat_id,
            "caller": {
                "id": caller_id,
                "name": caller_user["nickname"],
                "profile_photo": caller_user["profile_photo"]
            }
        }))
        
        # Send waiting status to caller
        await caller_websocket.send_text(json.dumps({
            "type": "call_status",
            "status": "ringing",
            "message": "Calling..."
        }))
        
    except Exception as e:
        logger.error(f"Error sending call notification: {str(e)}")
        await caller_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "Error initiating call"
        }))
        if chat_id in pending_calls:
            del pending_calls[chat_id]


async def handle_call_answer(chat_id: int, callee_id: int, response: str, callee_websocket: WebSocket):
    """Handle a response to a call request (accept/decline)"""
    logger.info(f"Call answer from user {callee_id} in chat {chat_id}: {response}")
    
    if chat_id not in pending_calls:
        await callee_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "No pending call found"
        }))
        return
    
    caller_id, expected_callee_id, _ = pending_calls[chat_id]
    
    if callee_id != expected_callee_id:
        await callee_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "You are not the recipient of this call"
        }))
        return
    
    # Check if caller is still connected
    if caller_id not in active_connections or chat_id not in active_connections[caller_id]:
        await callee_websocket.send_text(json.dumps({
            "type": "call_error",
            "message": "Caller has disconnected"
        }))
        del pending_calls[chat_id]
        return
    
    caller_websocket = active_connections[caller_id][chat_id]
    
    if response == "accept":
        # Call accepted
        await caller_websocket.send_text(json.dumps({
            "type": "call_accepted",
            "chat_id": chat_id
        }))
        
        await callee_websocket.send_text(json.dumps({
            "type": "call_connected",
            "chat_id": chat_id
        }))
        
    elif response == "decline":
        # Call declined - notify the caller
        await caller_websocket.send_text(json.dumps({
            "type": "call_declined",
            "message": "Call was declined"
        }))
        
        # Clear the calling status by sending a status update
        await caller_websocket.send_text(json.dumps({
            "type": "call_status",
            "status": "ended",
            "message": "Call declined"
        }))
    
    # Remove the pending call
    del pending_calls[chat_id]


async def handle_call_cancel(chat_id: int, caller_id: int):
    """Handle cancellation of an outgoing call"""
    logger.info(f"Call cancelled by user {caller_id} in chat {chat_id}")
    
    if chat_id not in pending_calls:
        return
    
    # Get the pending call details
    caller_id_check, callee_id, _ = pending_calls[chat_id]
    
    # Verify the caller is the one who initiated the call
    if caller_id != caller_id_check:
        return
    
    # Check if callee is connected
    if callee_id in active_connections and chat_id in active_connections[callee_id]:
        callee_websocket = active_connections[callee_id][chat_id]
        
        # Send cancellation notification to callee
        try:
            await callee_websocket.send_text(json.dumps({
                "type": "call_canceled",
                "message": "Call was canceled by the caller"
            }))
        except Exception as e:
            logger.error(f"Error sending call cancellation: {str(e)}")
    
    # Remove the pending call
    if chat_id in pending_calls:
        del pending_calls[chat_id]
