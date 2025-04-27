from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.db.chat_crud import get_user_chats, get_chat_messages, create_message, create_chat, get_db_connection
from app.db.group_crud import create_group, get_group_messages, get_group_by_id, get_group_members, add_group_message, get_user_groups
from app.models.schemas import ChatPreview, Message, MessageCreate, ChatCreate, GroupCreate
from app.core.config import logger

router = APIRouter()

@router.get("/", response_model=list[ChatPreview])
async def get_chats(current_user: dict = Depends(get_current_user)):
    """Get all chats for the authenticated user"""
    # Get both direct chats and groups
    direct_chats = get_user_chats(current_user['id'])
    group_chats = get_user_groups(current_user['id'])
    
    # Combine and sort by timestamp
    all_chats = direct_chats + group_chats
    all_chats.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    return all_chats

@router.get("/{chat_id}/messages", response_model=list[Message])
async def get_messages(chat_id: int, current_user: dict = Depends(get_current_user)):
    """Get messages for a specific chat"""
    messages = get_chat_messages(chat_id, current_user['id'])
    if messages is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found or you don't have access"
        )
    return messages

@router.post("/", response_model=ChatPreview)
async def create_new_chat(chat_request: ChatCreate, current_user: dict = Depends(get_current_user)):
    """Create a new chat with another user"""
    # Check if user is trying to create chat with themselves
    if chat_request.user_id == current_user['id']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create chat with yourself"
        )
    
    # Create or get existing chat
    chat = create_chat(current_user['id'], chat_request.user_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create chat"
        )
    
    return chat

@router.post("/{chat_id}/messages", response_model=Message)
async def send_message(chat_id: int, message: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a new message to a chat"""
    created_message = create_message(chat_id, current_user['id'], message.content)
    if created_message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found or you don't have access"
        )
    return created_message

# Group chat endpoints
@router.post("/groups", response_model=ChatPreview)
async def create_group_chat(group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    """Create a new group chat"""
    if not group_data.name or len(group_data.name) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name must be at least 3 characters"
        )
    
    if not group_data.member_ids or len(group_data.member_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group must have at least one member besides you"
        )
    
    try:
        # Create the group
        group = create_group(
            name=group_data.name,
            admin_id=current_user['id'],
            member_ids=group_data.member_ids
        )
        return group
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create group chat: {str(e)}"
        )

@router.get("/groups/{group_id}/messages", response_model=list[dict])
async def get_group_chat_messages(
    group_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all messages for a group chat"""
    try:
        return get_group_messages(group_id, current_user["id"])
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting group messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")


@router.post("/groups/{group_id}/messages", response_model=dict)
async def create_group_chat_message(
    group_id: int,
    message: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new message to a group chat"""
    try:
        new_message = add_group_message(group_id, current_user["id"], message.content)
        return new_message
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating group message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create message: {str(e)}")

@router.put("/messages/{message_id}", response_model=Message)
async def edit_message(
    message_id: int,
    message_update: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Edit an existing message"""
    # Get the message
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if message exists and belongs to the user
    cursor.execute(
        "SELECT * FROM messages WHERE id = ? AND sender_id = ?",
        (message_id, current_user['id'])
    )
    message = cursor.fetchone()
    
    if not message:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you don't have permission to edit it"
        )
    
    # Update the message
    cursor.execute(
        "UPDATE messages SET content = ? WHERE id = ?",
        (message_update.content, message_id)
    )
    conn.commit()
    
    # Get the updated message
    cursor.execute(
        "SELECT m.id, m.sender_id, u.nickname as sender_name, m.content, m.timestamp FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?",
        (message_id,)
    )
    updated_message = cursor.fetchone()
    conn.close()
    
    return {
        "id": updated_message['id'],
        "sender_id": updated_message['sender_id'],
        "sender_name": updated_message['sender_name'],
        "content": updated_message['content'],
        "timestamp": updated_message['timestamp'],
        "is_sent_by_me": True
    }

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if message exists and belongs to the user
    cursor.execute(
        "SELECT * FROM messages WHERE id = ? AND sender_id = ?",
        (message_id, current_user['id'])
    )
    message = cursor.fetchone()
    
    if not message:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you don't have permission to delete it"
        )
    
    # Delete the message
    cursor.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    conn.commit()
    conn.close()
    
    return {"status": "success"}
