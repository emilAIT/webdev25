from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from .models import Conversation, ConversationParticipant, Message, User
from .schemas import ConversationCreate, MessageResponse
from fastapi.security import OAuth2PasswordBearer
from .auth import get_current_user

router = APIRouter(prefix="/chat")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/signin")


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
    return [{"id": conv.id, "name": conv.name} for conv in conversations]


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
    return messages
