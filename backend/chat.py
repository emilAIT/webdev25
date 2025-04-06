from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from .models import Conversation, ConversationParticipant, Message, User
from .schemas import ConversationCreate, MessageResponse, MessageCreate
from .auth import get_current_user
from sqlalchemy import and_

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
    conversations = (
        db.query(Conversation)
        .join(ConversationParticipant)
        .filter(ConversationParticipant.user_id == user.id)
        .all()
    )
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
            if len(participants) == 2
            else conv.name or "Group Chat"
        )

        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.timestamp.desc())
            .first()
        )
        last_message_content = (
            last_message.content if last_message else "No messages yet"
        )

        result.append(
            {
                "id": conv.id,
                "name": display_name,
                "last_message": last_message_content,
                "participants": [p.username for p in participants],
            }
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
            "content": msg.content if not msg.is_deleted else "[Message deleted]",
            "timestamp": msg.timestamp,
            "replied_to_id": msg.replied_to_id,
            "is_deleted": msg.is_deleted,
            "replied_to_content": None,
            "replied_to_sender": None,
        }

        # If this is a reply, add the parent message content
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

        result.append(message_dict)

    return result


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
