from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from .models import Conversation, ConversationParticipant, Message, User
from .schemas import ConversationCreate, MessageResponse
from .auth import get_current_user

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
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp)
        .all()
    )
    print(
        f"Fetched {len(messages)} messages for conversation {conversation_id}: {[msg.content for msg in messages]}"
    )
    return messages
