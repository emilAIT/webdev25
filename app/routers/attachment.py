from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
import shutil
from datetime import datetime
import uuid
from pathlib import Path

from app.database import User, Room, Message, room_members
from app.routers.session import get_db
from app.routers.websockets import notify_new_message

router = APIRouter()

# Define allowed file extensions
ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"],
    "video": [".mp4", ".webm", ".mov", ".avi"],
    "audio": [".mp3", ".wav", ".ogg", ".m4a"],
    "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".rtf"],
}

# Maximum file size (20MB)
MAX_FILE_SIZE = 20 * 1024 * 1024


@router.post("/api/messages/attachment")
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    room_id: int = Form(...),
    attachment_type: str = Form(...),
    db: Session = Depends(get_db),
):
    """Upload file attachment to a chat"""
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
        is_member = (
            db.query(room_members)
            .filter(
                room_members.c.room_id == room_id, room_members.c.user_id == user.id
            )
            .first()
        )

        if not is_member:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        # Check file content
        content = await file.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 20MB)")

        # Reset file position after reading
        await file.seek(0)

        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1].lower()

        # Validate file extension matches the claimed attachment type
        # Only validate if the attachment type has an allowed list
        if (
            attachment_type in ALLOWED_EXTENSIONS
            and file_extension not in ALLOWED_EXTENSIONS[attachment_type]
        ):
            raise HTTPException(
                status_code=400, detail=f"Invalid {attachment_type} file type"
            )

        upload_dir = Path("app/static/uploads/attachments")
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename with timestamp and random component
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = f"{timestamp}_{unique_id}{file_extension}"
        file_path = upload_dir / safe_filename

        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Construct the file URL
        file_url = f"/static/uploads/attachments/{safe_filename}"

        # Create friendly display name based on attachment type
        display_name = ""
        if attachment_type == "photo" or attachment_type == "image":
            display_name = "📷 Photo"
            content = f"<img-attachment src='{file_url}' filename='{file.filename}'>"
        elif attachment_type == "video":
            display_name = "🎥 Video"
            content = f"<video-attachment src='{file_url}' filename='{file.filename}'>"
        elif attachment_type == "audio":
            display_name = "🎵 Audio"
            content = f"<audio-attachment src='{file_url}' filename='{file.filename}'>"
        else:  # document
            display_name = "📄 Document"
            content = f"<doc-attachment src='{file_url}' filename='{file.filename}'>"

        # Create message in database
        new_message = Message(
            content=content,
            sender_id=user.id,
            room_id=room_id,
            timestamp=datetime.now(),
            delivered=True,
            read=False,
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
                "type": attachment_type,
                "url": file_url,
                "filename": file.filename,
            },
            "display_name": display_name,  # Add a display name for sidebar
        }

        # Notify WebSocket about new message
        try:
            print(f"Notifying about new attachment message in room {room_id}")
            await notify_new_message(room_id, user.id, message_response)
        except Exception as ws_error:
            print(f"Error notifying about attachment via WebSocket: {str(ws_error)}")

        return {"success": True, "message": message_response, "file_url": file_url}
    except Exception as e:
        # Log the error
        print(f"Error uploading attachment: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload attachment: {str(e)}"
        )
