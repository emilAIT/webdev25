from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Path, File, UploadFile
from sqlalchemy.orm import Session
from mimetypes import guess_type
from sqlalchemy import desc

from . import models, schemas
from .database import get_db
from .auth import get_current_user # Import needed auth functions
from .storage import storage_client, MAX_FILE_SIZE # Import storage client and config

router = APIRouter()

# Group API Endpoints
@router.post("/group/append", response_model=schemas.Group)
async def create_group(
    group: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new group and optionally add contacts as members"""
    db_group = models.Group(group_name=group.group_name, description=group.description)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    group_member = models.GroupMember(
        group_id=db_group.id,
        member_id=current_user.id,
        status="admin",
    )
    db.add(group_member)

    if group.member_ids:
        contact_ids = [contact.id for contact in current_user.contacts]
        for member_id in group.member_ids:
            if member_id == current_user.id:
                continue
            if member_id in contact_ids:
                user = db.query(models.User).filter(models.User.id == member_id).first()
                if user:
                    member = models.GroupMember(
                        group_id=db_group.id,
                        member_id=member_id,
                        status="member",
                    )
                    db.add(member)

    db.commit()
    return db_group

@router.post("/group/add_user/{group_id}", response_model=schemas.GroupMember)
async def add_user_to_group(
    group_id: int = Path(..., description="The ID of the group"),
    user_data: schemas.GroupAddUser = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    user = db.query(models.User).filter(models.User.id == user_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == user_data.user_id,
        )
        .first()
    )
    if existing_member:
        raise HTTPException(
            status_code=400, detail="User is already a member of this group"
        )

    group_member = models.GroupMember(group_id=group_id, member_id=user_data.user_id)
    db.add(group_member)
    db.commit()
    db.refresh(group_member)
    return group_member

@router.delete("/group/delete/{group_id}", response_model=dict)
async def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    admin_check = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
            models.GroupMember.status == "admin",
        )
        .first()
    )
    if not admin_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can delete the group",
        )

    db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id
    ).delete()
    db.query(models.GroupMessage).filter(
        models.GroupMessage.group_id == group_id
    ).delete()
    db.delete(group)
    db.commit()
    return {"message": f"Group {group_id} has been deleted successfully"}

@router.delete("/group/delete_user/{group_id}/{user_id}", response_model=dict)
async def remove_user_from_group(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    admin_check = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
            models.GroupMember.status == "admin",
        )
        .first()
    )
    if not admin_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can remove users from the group",
        )

    group_member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == user_id,
        )
        .first()
    )
    if not group_member:
        raise HTTPException(
            status_code=404, detail="User is not a member of this group"
        )

    db.delete(group_member)
    db.commit()
    return {"message": f"User {user_id} has been removed from group {group_id}"}

@router.put("/groups/{group_id}", response_model=schemas.Group)
async def update_group_details(
    group_id: int,
    group_data: schemas.GroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    admin_check = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
            models.GroupMember.status == "admin",
        )
        .first()
    )
    if not admin_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can update group details",
        )

    updated = False
    if group_data.group_name is not None:
        group.group_name = group_data.group_name
        updated = True
    if group_data.description is not None:
        group.description = group_data.description
        updated = True

    if updated:
        db.commit()
        db.refresh(group)

    return group

@router.post("/groups/{group_id}/avatar", response_model=schemas.Group)
async def upload_group_avatar(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    admin_check = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
            models.GroupMember.status == "admin",
        )
        .first()
    )
    if not admin_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admin can change the avatar",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE/1024/1024:.1f}MB",
        )

    content_type = file.content_type or guess_type(file.filename)[0]
    if not content_type or not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only images are allowed for avatars.",
        )

    try:
        folder_path = f"group_avatars/group_{group_id}"
        media_data = await storage_client.upload_file(
            file, folder=folder_path, user_id=current_user.id
        )
        if not media_data or "error" in media_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=media_data.get("error", "Failed to upload avatar"),
            )
    except Exception as e:
        print(f"Exception during group avatar upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload avatar: {str(e)}",
        )

    group.avatar_url = media_data["url"]
    db.commit()
    db.refresh(group)

    return group

@router.get("/users/me/groups", response_model=List[schemas.Group])
async def get_my_groups(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    groups_orm = (
        db.query(models.Group)
        .join(models.GroupMember, models.Group.id == models.GroupMember.group_id)
        .filter(models.GroupMember.member_id == current_user.id)
        .all()
    )

    groups_with_last_message = []
    for group in groups_orm:
        # Get the last message ORM object for the group
        last_message_orm = (
            db.query(models.GroupMessage)
            .filter(models.GroupMessage.group_id == group.id)
            .order_by(desc(models.GroupMessage.timestamp))
            .first()
        )

        # Convert last_message ORM to Pydantic schema (if exists)
        # Assuming Pydantic v2+, use model_validate
        last_message_schema = schemas.GroupMessage.model_validate(last_message_orm) if last_message_orm else None

        # Manually create the Group schema, including the last_message
        group_schema = schemas.Group(
            id=group.id,
            group_name=group.group_name,
            description=group.description,
            avatar_url=group.avatar_url, # Ensure this field exists and is correct
            last_message=last_message_schema # Assign the converted last_message
        )
        groups_with_last_message.append(group_schema)

    return groups_with_last_message

@router.get("/groups/{group_id}", response_model=schemas.GroupWithDetails)
async def get_group_details(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = (
        db.query(models.User)
        .join(models.GroupMember, models.User.id == models.GroupMember.member_id)
        .filter(models.GroupMember.group_id == group_id)
        .all()
    )

    messages = (
        db.query(models.GroupMessage)
        .filter(models.GroupMessage.group_id == group_id)
        .order_by(models.GroupMessage.timestamp.desc())
        .limit(50)
        .all()
    )

    group_details = schemas.GroupWithDetails(
        id=group.id,
        group_name=group.group_name,
        description=group.description,
        avatar_url=group.avatar_url,
        members=members,
        messages=messages,
    )
    return group_details

@router.delete("/groups/{group_id}/leave", response_model=dict)
async def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group_member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
        )
        .first()
    )

    if not group_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this group",
        )

    db.delete(group_member)
    db.commit()
    return {"message": f"You have successfully left group {group_id}"}

# Folder API Endpoints (Combined into group_service)
@router.post("/folders", response_model=schemas.Folder, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_folder = models.Folder(
        name=folder.name,
        description=folder.description,
        owner_id=current_user.id,
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.get("/folders", response_model=List[schemas.Folder])
async def get_folders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folders = (
        db.query(models.Folder).filter(models.Folder.owner_id == current_user.id).all()
    )
    return folders

@router.get("/folders/{folder_id}", response_model=schemas.FolderWithGroups)
async def get_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id, models.Folder.owner_id == current_user.id
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder

@router.put("/folders/{folder_id}", response_model=schemas.Folder)
async def update_folder(
    folder_id: int,
    folder_data: schemas.FolderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id, models.Folder.owner_id == current_user.id
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    if folder_data.name is not None:
        folder.name = folder_data.name
    if folder_data.description is not None:
        folder.description = folder_data.description

    db.commit()
    db.refresh(folder)
    return folder

@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id, models.Folder.owner_id == current_user.id
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    db.query(models.Group).filter(models.Group.folder_id == folder_id).update(
        {"folder_id": None}
    )
    db.delete(folder)
    db.commit()
    return None

@router.put("/groups/{group_id}/move-to-folder/{folder_id}", response_model=schemas.Group)
async def move_group_to_folder(
    group_id: int,
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group_member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
        )
        .first()
    )
    if not group_member:
        raise HTTPException(status_code=404, detail="Group not found or not a member")

    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id, models.Folder.owner_id == current_user.id
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    group.folder_id = folder_id
    db.commit()
    db.refresh(group)
    return group

@router.put("/groups/{group_id}/remove-from-folder", response_model=schemas.Group)
async def remove_group_from_folder(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group_member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.member_id == current_user.id,
        )
        .first()
    )
    if not group_member:
        raise HTTPException(status_code=404, detail="Group not found or not a member")

    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if group.folder_id is None:
        raise HTTPException(status_code=400, detail="Group is not in any folder")

    folder = db.query(models.Folder).filter(models.Folder.id == group.folder_id).first()
    if folder and folder.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to modify this folder"
        )

    group.folder_id = None
    db.commit()
    db.refresh(group)
    return group 