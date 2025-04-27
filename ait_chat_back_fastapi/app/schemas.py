from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class ContactAdd(BaseModel):
    username: str


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int
    is_active: bool
    is_online: bool
    last_seen: datetime
    registered_at: datetime
    unread_count: int = 0
    description: Optional[str] = None
    nickname: Optional[str] = None

    class Config:
        from_attributes = True


class MessageBase(BaseModel):
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # 'image', 'video', 'audio', 'document'
    media_filename: Optional[str] = None
    media_size: Optional[int] = None


class MessageCreate(MessageBase):
    recipient_id: Optional[int] = None


class Message(MessageBase):
    id: int
    timestamp: datetime
    sender_id: int
    recipient_id: Optional[int] = None
    sender: User
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    username: Optional[str] = None


class WebSocketMessage(BaseModel):
    action: str
    payload: dict


# Group schemas
class GroupBase(BaseModel):
    group_name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None  # Added avatar URL


class GroupCreate(GroupBase):
    member_ids: Optional[List[int]] = None


class Group(GroupBase):
    id: int

    class Config:
        from_attributes = True


class GroupMemberBase(BaseModel):
    group_id: int
    member_id: int
    status: str = "member"  # Default status is "member"


class GroupMemberCreate(GroupMemberBase):
    pass


class GroupMember(GroupMemberBase):
    id: int

    class Config:
        from_attributes = True


class GroupMessageBase(BaseModel):
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # 'image', 'video', 'audio', 'document'
    media_filename: Optional[str] = None
    media_size: Optional[int] = None


class GroupMessageCreate(GroupMessageBase):
    group_id: int


class GroupMessage(GroupMessageBase):
    id: int
    group_id: int
    sender_id: int
    timestamp: datetime
    read_at: Optional[datetime] = None
    sender: User

    class Config:
        from_attributes = True


# Extended Group schema with member and message information
class GroupWithDetails(Group):
    members: List[User] = []
    messages: List[GroupMessage] = []
    # avatar_url is inherited from Group

    class Config:
        from_attributes = True


# New schemas for group operations
class GroupAddUser(BaseModel):
    user_id: int


class GroupUpdate(BaseModel):
    group_name: Optional[str] = None
    description: Optional[str] = None


# New schemas for user profile updates
class UserUpdate(BaseModel):
    """Schema for full user profile update"""

    username: Optional[str] = None
    email: Optional[EmailStr] = None
    description: Optional[str] = None


class UsernameUpdate(BaseModel):
    """Schema for updating just the username"""

    username: str


class EmailUpdate(BaseModel):
    """Schema for updating just the email"""

    email: EmailStr


class DescriptionUpdate(BaseModel):
    """Schema for updating just the user description"""

    description: str


class PasswordUpdate(BaseModel):
    """Schema for updating a user's password"""

    current_password: str
    new_password: str


class NicknameUpdate(BaseModel):
    """Schema for updating just the user nickname"""

    nickname: Optional[str] = None


# Folder schemas
class FolderBase(BaseModel):
    name: str
    description: Optional[str] = None


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Folder(FolderBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FolderWithGroups(Folder):
    groups: List[Group] = []

    class Config:
        from_attributes = True


class MediaFileResponse(BaseModel):
    """Response schema for uploaded media files"""

    url: str
    filename: str
    media_type: str
    size: int


class MediaFile(BaseModel):
    """Schema for media file metadata"""

    id: str
    url: str
    filename: str
    media_type: str
    size: int
    uploaded_at: datetime
    user_id: int

    class Config:
        from_attributes = True


# Add this at the very end of the file if needed:
User.model_rebuild()
Group.model_rebuild()
Message.model_rebuild()
GroupMessage.model_rebuild()
# Add any other models that use forward references
