from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import os
import shutil
from datetime import datetime
import uuid
from pathlib import Path

from app.database import User, Room, Message
from app.routers.session import get_db
from app.routers.websockets import notify_new_message

router = APIRouter(prefix="/api/messages", tags=["messages"])

# Maximum file size (20MB)
MAX_FILE_SIZE = 20 * 1024 * 1024

@router.post("/audio")
async def upload_audio_message(
    request: Request,
    audio: UploadFile = File(...),
    room_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """Upload audio message to a chat"""
    # Check if user is authenticated
    if "username" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    username = request.session["username"]
    
    try:
        # Get the current user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if room exists and user is a member
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        
        # Check if user is a member of this room
        is_member = db.query(Room).join(
            Room.members
        ).filter(
            Room.id == room_id,
            User.id == user.id
        ).first()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a member of this room")
        
        # Check file content
        content = await audio.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Audio file too large (max 20MB)")
        
        # Reset file position after reading
        await audio.seek(0)
        
        # Create directory if it doesn't exist
        upload_dir = Path("app/static/uploads/audio")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename with timestamp and random component
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = f"{timestamp}_{unique_id}.webm"
        file_path = upload_dir / safe_filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        # Construct the file URL
        file_url = f"/static/uploads/audio/{safe_filename}"
        
        # Create message content with audio tag
        content = f"<audio-attachment src='{file_url}' filename='audio-message.webm'>"
        
        # Create message in database
        new_message = Message(
            content=content,
            sender_id=user.id,
            room_id=room_id,
            timestamp=datetime.now(),
            delivered=True,
            read=False
        )
        
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        
        # Prepare message response
        message_response = {
            "id": new_message.id,
            "content": new_message.content,
            "sender_id": new_message.sender_id,
            "sender": user.username,
            "sender_name": user.full_name or user.username,
            "room_id": room_id,
            "timestamp": new_message.timestamp.isoformat(),
            "time": new_message.timestamp.strftime("%H:%M"),
            "delivered": True,
            "read": False,
            "is_group": room.is_group,
            "attachment": {
                "type": "audio",
                "url": file_url,
                "filename": "audio-message.webm"
            },
            "display_name": "🎵 Audio Message"
        }
        
        # Notify WebSocket about new message
        try:
            await notify_new_message(room_id, user.id, message_response)
        except Exception as ws_error:
            print(f"Error notifying about audio message via WebSocket: {str(ws_error)}")
        
        return {
            "success": True, 
            "message": message_response,
            "file_url": file_url
        }
    
    except Exception as e:
        # Log the error
        print(f"Error uploading audio message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload audio message: {str(e)}")
