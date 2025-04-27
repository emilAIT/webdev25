from fastapi import APIRouter, Depends, Body, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.services.ai import GeminiService
from app.database.database import get_db
from sqlalchemy.orm import Session
from app.models.models import DirectChat, Group
import os

router = APIRouter(tags=["ai"])


# Pydantic models for request validation
class AIRequest(BaseModel):
    prompt: str
    model: str = "gemini-2.0-flash"
    chat_id: Optional[int] = Field(default=None)
    group_id: Optional[int] = Field(default=None)
    use_config_prompt: bool = True


class ConfigPromptRequest(BaseModel):
    prompt: str
    chat_id: Optional[int] = Field(default=None)
    group_id: Optional[int] = Field(default=None)


# Initialize the Gemini service
gemini_service = GeminiService(api_key=os.environ.get("GEMINI_API_KEY"))


@router.post("/generate")
async def generate_ai_response(
    request: AIRequest = Body(...), db: Session = Depends(get_db)
):
    """
    Generate a response from the AI model
    """
    try:
        final_prompt = request.prompt

        # If requested to use config prompt and a chat or group is specified
        if request.use_config_prompt and (request.chat_id or request.group_id):
            config_prompt = None

            # Get the config prompt from the database
            if request.chat_id:
                chat = (
                    db.query(DirectChat)
                    .filter(DirectChat.id == request.chat_id)
                    .first()
                )
                if chat and chat.ai_config_prompt:
                    config_prompt = chat.ai_config_prompt
            elif request.group_id:
                group = db.query(Group).filter(Group.id == request.group_id).first()
                if group and group.ai_config_prompt:
                    config_prompt = group.ai_config_prompt

            # Combine the config prompt with the user prompt if a config exists
            if config_prompt:
                final_prompt = f"{config_prompt}\n\nUser query: {request.prompt}"

        system_prompt = "You are a helpful AI assistant."
        final_prompt = f"{system_prompt}\n\n{final_prompt}"

        response = await gemini_service.generate_response(
            prompt=final_prompt, model=request.model
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config-prompt")
async def get_config_prompt(
    chat_id: int = None, group_id: int = None, db: Session = Depends(get_db)
):
    """
    Get the configuration prompt for a chat or group
    """
    if not chat_id and not group_id:
        raise HTTPException(
            status_code=400, detail="Either chat_id or group_id must be provided"
        )

    try:
        if chat_id:
            chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
            if not chat:
                raise HTTPException(status_code=404, detail="Chat not found")
            return {"prompt": chat.ai_config_prompt or ""}
        else:
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group:
                raise HTTPException(status_code=404, detail="Group not found")
            return {"prompt": group.ai_config_prompt or ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config-prompt")
async def save_config_prompt(
    request: ConfigPromptRequest = Body(...), db: Session = Depends(get_db)
):
    """
    Save a configuration prompt for a chat or group
    """
    if not request.chat_id and not request.group_id:
        raise HTTPException(
            status_code=400, detail="Either chat_id or group_id must be provided"
        )

    try:
        if request.chat_id:
            chat = db.query(DirectChat).filter(DirectChat.id == request.chat_id).first()
            if not chat:
                raise HTTPException(status_code=404, detail="Chat not found")
            chat.ai_config_prompt = request.prompt
            db.commit()
            return {"success": True, "message": "Chat configuration prompt updated"}
        else:
            group = db.query(Group).filter(Group.id == request.group_id).first()
            if not group:
                raise HTTPException(status_code=404, detail="Group not found")
            group.ai_config_prompt = request.prompt
            db.commit()
            return {"success": True, "message": "Group configuration prompt updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
