from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from .models import Conversation, ConversationParticipant, Message, User
from .schemas import ConversationCreate, MessageResponse, MessageCreate
from .auth import get_current_user
from sqlalchemy import and_
from datetime import datetime  # Import datetime
from .ws_manager import (
    sio,
    connected_users,
)  # Import WebSocket components from ws_manager

router = APIRouter(prefix="/chat")


@router.post("/conversations", response_model=dict)
def create_conversation(
    conversation: ConversationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_conversation = Conversation(name=conversation.name)
    db.add(new_conversation)
    db.commit()
    db.refresh(new_conversation)
    for pid in conversation.participant_ids:
        participant = ConversationParticipant(
            conversation_id=new_conversation.id, user_id=pid
        )
        db.add(participant)
    db.commit()
    return {"message": "Conversation created", "conversation_id": new_conversation.id}


@router.get("/conversations", response_model=list[dict])
def get_conversations(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Fetch conversations the user is part of
    user_participants = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.user_id == user.id)
        .all()
    )
    conversation_ids = [p.conversation_id for p in user_participants]

    if not conversation_ids:
        return []

    conversations = (
        db.query(Conversation).filter(Conversation.id.in_(conversation_ids)).all()
    )

    # Create a map for quick lookup of participant info
    participant_map = {p.conversation_id: p for p in user_participants}

    result = []
    for conv in conversations:
        participants = (
            db.query(User)
            .join(ConversationParticipant)
            .filter(ConversationParticipant.conversation_id == conv.id)
            .all()
        )
        participant_usernames = [p.username for p in participants if p.id != user.id]
        display_name = (
            participant_usernames[0]
            if len(participants) == 2 and participant_usernames
            else conv.name or f"Group Chat ({len(participants)} members)"
        )

        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.timestamp.desc())
            .first()
        )
        last_message_content = (
            last_message.content
            if last_message and not last_message.is_deleted
            else "No messages yet"
        )

        # Get the participant record for the current user in this conversation
        current_participant = participant_map.get(conv.id)
        last_read = (
            current_participant.last_read_timestamp if current_participant else None
        )

        # Calculate unread count based on last read timestamp
        unread_query = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != user.id,
            Message.is_deleted == False,  # Don't count deleted messages as unread
        )
        if last_read:
            unread_query = unread_query.filter(Message.timestamp > last_read)

        unread_count = unread_query.count()

        result.append(
            {
                "id": conv.id,
                "name": display_name,
                "last_message": last_message_content,
                "participants": [p.username for p in participants],
                "unread_count": unread_count,
            }
        )

    # Sort conversations by last message timestamp (descending)
    # We need to fetch the timestamp for sorting
    conv_last_timestamps = {
        c.id: db.query(Message.timestamp)
        .filter(Message.conversation_id == c.id)
        .order_by(Message.timestamp.desc())
        .limit(1)
        .scalar()
        or datetime.min
        for c in conversations
    }
    result.sort(
        key=lambda x: conv_last_timestamps.get(x["id"], datetime.min), reverse=True
    )

    print(
        f"Fetched {len(result)} conversations for user {user.id}: {[conv['name'] for conv in result]}"
    )
    return result


@router.get("/messages/{conversation_id}", response_model=list[MessageResponse])
def get_messages(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check if user is a participant in the conversation
    participant = (
        db.query(ConversationParticipant)
        .filter(
            and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user.id,
            )
        )
        .first()
    )

    if not participant:
        raise HTTPException(
            status_code=403, detail="Not authorized to view this conversation"
        )

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp)
        .all()
    )

    # Enhance messages with reply content
    result = []
    for msg in messages:
        message_dict = {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            # Include sender username for potential future use
            "sender_username": msg.sender.username,
            "content": msg.content if not msg.is_deleted else "[Message deleted]",
            "timestamp": msg.timestamp.isoformat(),  # Ensure timestamp is ISO format string
            "is_deleted": msg.is_deleted,
            "replied_to_id": msg.replied_to_id,
            "replied_to_content": None,  # Initialize reply fields
            "replied_to_sender": None,
            "replied_to_username": None,
            "read_at": (
                msg.read_at.isoformat() if msg.read_at else None
            ),  # Include read_at timestamp
        }

        # Fetch replied message details if it exists
        if msg.replied_to_id:
            replied_msg = (
                db.query(Message).filter(Message.id == msg.replied_to_id).first()
            )
            if replied_msg:
                message_dict["replied_to_content"] = (
                    replied_msg.content
                    if not replied_msg.is_deleted
                    else "[Message deleted]"
                )
                message_dict["replied_to_sender"] = replied_msg.sender_id
                # Include username for better display
                message_dict["replied_to_username"] = replied_msg.sender.username

        result.append(message_dict)

    return result


@router.post("/conversations/{conversation_id}/mark_read")
async def mark_conversation_as_read(  # Make the function async
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user.id,
        )
        .first()
    )

    if not participant:
        raise HTTPException(
            status_code=404, detail="Participant not found in this conversation"
        )

    now = datetime.utcnow()
    participant.last_read_timestamp = now

    # Find messages sent by others in this conversation that haven't been marked as read
    messages_to_update = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != user.id,  # Messages sent by others
            Message.read_at == None,  # That are not yet marked as read
        )
        .all()
    )

    updated_message_ids_by_sender = {}
    if messages_to_update:
        for msg in messages_to_update:
            msg.read_at = now
            if msg.sender_id not in updated_message_ids_by_sender:
                updated_message_ids_by_sender[msg.sender_id] = []
            updated_message_ids_by_sender[msg.sender_id].append(msg.id)

    db.commit()
    print(
        f"User {user.id} marked conversation {conversation_id} as read at {now}. Updated {len(messages_to_update)} messages."
    )

    # Notify senders via WebSocket
    if updated_message_ids_by_sender:
        # Find socket IDs for each sender
        sender_ids = list(updated_message_ids_by_sender.keys())
        # Invert connected_users for easier lookup (user_id -> list of sids)
        user_sockets = {}
        for sid, uid in connected_users.items():
            if uid not in user_sockets:
                user_sockets[uid] = []
            user_sockets[uid].append(sid)

        for sender_id, message_ids in updated_message_ids_by_sender.items():
            if sender_id in user_sockets:
                for sid in user_sockets[sender_id]:
                    await sio.emit(
                        "messages_read",
                        {
                            "conversation_id": conversation_id,
                            "message_ids": message_ids,
                        },
                        room=sid,  # Send directly to the sender's socket
                    )
                    print(
                        f"Notified user {sender_id} (sid: {sid}) about read messages: {message_ids}"
                    )

    return {"status": "success", "message": "Conversation marked as read"}


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get the message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check if user is the sender of the message
    if message.sender_id != user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this message"
        )

    # Mark message as deleted instead of removing it
    message.is_deleted = True
    db.commit()

    return {"status": "success", "message": "Message deleted"}
