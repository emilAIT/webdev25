import os
import uuid
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, status, Form
from typing import List
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS, MAX_CONTENT_LENGTH
from app.db import user_crud
from app.models.schemas import User, UserSearch, ProfileUpdate
from app.utils.password import verify_password

router = APIRouter()

def allowed_file(filename):
    """Check if the file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@router.get("/search", response_model=List[UserSearch])
async def search_users(
    query: str = Query(..., min_length=3),
    current_user: User = Depends(get_current_user)
):
    """
    Search for users by name, email, or phone number.
    Returns a list of users matching the query (excluding the current user).
    """
    users = user_crud.search_users(query)
    
    # Filter out the current user from results
    filtered_users = [user for user in users if user["id"] != current_user["id"]]
    
    # Return at most 20 results
    return filtered_users[:20]

@router.get("/me", response_model=dict)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get the profile of the current logged-in user"""
    # Создаем словарь с данными пользователя из объекта SQLite.Row
    profile = {}
    try:
        # Базовые поля, которые должны быть у всех пользователей
        required_fields = ["id", "nickname", "email", "phone", "status"]
        for field in required_fields:
            profile[field] = current_user[field]
        
        # Безопасно получаем profile_photo, если есть
        try:
            # Проверяем, существует ли колонка profile_photo
            if "profile_photo" in current_user.keys():
                profile["profile_photo"] = current_user["profile_photo"]
            else:
                profile["profile_photo"] = None
        except Exception:
            # Если keys() не доступен или другая ошибка
            try:
                profile["profile_photo"] = current_user["profile_photo"]
            except (KeyError, IndexError):
                profile["profile_photo"] = None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user profile: {str(e)}"
        )
    
    return profile

@router.post("/profile-photo", response_model=dict)
async def update_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a new profile photo for the current user"""
    try:
        # Validate the file
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if not allowed_file(file.filename):
            raise HTTPException(
                status_code=400, 
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Read file content to check size
        contents = await file.read()
        if len(contents) > MAX_CONTENT_LENGTH:
            raise HTTPException(
                status_code=400, 
                detail=f"File size too large. Maximum size: {MAX_CONTENT_LENGTH/1024/1024} MB"
            )
        
        # Reset file pointer to beginning
        await file.seek(0)
        
        # Generate a unique filename
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Ensure upload directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Save file
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Update user profile in database
        relative_path = f"/{UPLOAD_FOLDER}/{unique_filename}"
        success = user_crud.update_user_photo(current_user["id"], relative_path)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update profile photo")
        
        return {
            "success": True, 
            "profile_photo": relative_path,
            "message": "Profile photo updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading photo: {str(e)}")

@router.api_route("/profile", methods=["POST", "PUT"], response_model=dict)
async def update_profile(
    nickname: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    profile_photo: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Update user profile information and optionally profile photo.
    Accepts multipart/form-data (for file upload) or just form fields.
    """
    try:
        # Обновляем профиль
        success = user_crud.update_user_profile(
            current_user["id"],
            nickname,
            email,
            phone
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update profile")

        # Если был передан файл, обрабатываем его
        if profile_photo:
            if not allowed_file(profile_photo.filename):
                raise HTTPException(
                    status_code=400,
                    detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
                )
            contents = await profile_photo.read()
            if len(contents) > MAX_CONTENT_LENGTH:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size too large. Maximum size: {MAX_CONTENT_LENGTH/1024/1024} MB"
                )
            await profile_photo.seek(0)
            file_extension = profile_photo.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
            with open(file_path, "wb") as buffer:
                buffer.write(contents)
            relative_path = f"/{UPLOAD_FOLDER}/{unique_filename}"
            photo_success = user_crud.update_user_photo(current_user["id"], relative_path)
            if not photo_success:
                raise HTTPException(status_code=500, detail="Failed to update profile photo")

        updated_user = user_crud.get_user_by_id(current_user["id"])
        return {
            "success": True,
            "message": "Profile updated successfully",
            "nickname": updated_user["nickname"] if updated_user else nickname
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating profile: {str(e)}")

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password", response_model=dict)
async def change_password(
    req: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    if not verify_password(req.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if req.current_password == req.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current")
    success = user_crud.change_user_password(current_user["id"], req.new_password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to change password")
    return {"success": True, "message": "Password changed successfully"}