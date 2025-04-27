import json
import logging
from fastapi import WebSocket, Query
from app.core.auth import authenticate_user
from app.db import message_crud, chat_crud

connected_clients = {}

async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...)
):
    await websocket.accept()
    user_data = authenticate_user(token)
    if not user_data:
        await websocket.close(code=4001)
        return

    chat = chat_crud.get_chat_by_id(chat_id)
    if not chat or (chat["user1_id"] != user_data["id"] and chat["user2_id"] != user_data["id"]):
        await websocket.close(code=4003)
        return

    if chat_id not in connected_clients:
        connected_clients[chat_id] = []
    connected_clients[chat_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                json_data = json.loads(data)
                message_content = json_data.get('content')
                message_type = json_data.get('type', 'text')  # Default to text if not specified
                
                if not message_content:
                    await websocket.send_json({
                        "type": "error", 
                        "message": "Message content is required"
                    })
                    continue
                
                # Validate message type
                if message_type not in ["text", "image", "voice_message"]:
                    await websocket.send_json({
                        "type": "error", 
                        "message": "Invalid message type"
                    })
                    continue
                
                # Create message in database with type
                new_message = message_crud.create_message(
                    chat_id, 
                    user_data["id"], 
                    message_content,
                    message_type
                )
                
                if not new_message:
                    await websocket.send_json({
                        "type": "error", 
                        "message": "Failed to create message"
                    })
                    continue
                
                # Update chat details
                display_content = message_content if message_type == "text" else "📷 Image" if message_type == "image" else "🎤 Voice message"
                chat_crud.update_chat_latest_message(chat_id, display_content)
                
                # Update recipient's unread count
                recipient_id = chat["user1_id"] if chat["user1_id"] != user_data["id"] else chat["user2_id"]
                chat_crud.increment_unread_messages(chat_id, recipient_id)
                
                # Broadcast message to all connected clients for this chat
                for client_ws in connected_clients[chat_id]:
                    await client_ws.send_json({
                        "type": "new_message",
                        "message": {
                            "id": new_message["id"],
                            "chat_id": new_message["chat_id"],
                            "sender_id": new_message["sender_id"],
                            "content": new_message["content"],
                            "timestamp": new_message["timestamp"],
                            "is_sent_by_me": new_message["sender_id"] == user_data["id"],
                            "sender_name": new_message["sender_name"],
                            "type": message_type
                        }
                    })
                
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error", 
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logging.error(f"Error processing message: {e}")
                await websocket.send_json({
                    "type": "error", 
                    "message": "Server error processing message"
                })
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
    finally:
        connected_clients[chat_id].remove(websocket)
        if not connected_clients[chat_id]:
            del connected_clients[chat_id]
        await websocket.close()