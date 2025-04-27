from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class GroupChatCreate(BaseModel):
    name: str
    member_ids: List[int]
    avatar: Optional[str] = None
    description: Optional[str] = None

class GroupChatUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    description: Optional[str] = None

class GroupChatResponse(BaseModel):
    id: int
    name: str
    avatar: Optional[str]
    description: Optional[str]
    owner_id: int
    created_at: datetime
    members: List[dict]

class GroupChatMember(BaseModel):
    user_id: int
    role: str

class GroupChatInfo(BaseModel):
    id: int
    name: str
    avatar: Optional[str]
    description: Optional[str]
    owner_id: int
    created_at: datetime
    members: List[GroupChatMember]

class GroupChatMemberAdd(BaseModel):
    user_ids: List[int]

class GroupChatMemberRemove(BaseModel):
    user_ids: List[int]
