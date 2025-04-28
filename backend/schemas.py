from pydantic import BaseModel, EmailStr, Field
from typing import Annotated

class UserBase(BaseModel):
    username: Annotated[str, Field(min_length=3, max_length=50, strip_whitespace=True, strict=True)]  
    email: EmailStr  

class UserCreate(UserBase):
    password: Annotated[str, Field(min_length=8, max_length=128, strict=True)]  

class UserInDB(UserBase):
    id: Annotated[int, Field(strict=True)]
    hashed_password: Annotated[str, Field(strict=True)]
    is_verified: Annotated[bool, Field(strict=True)]

    class Config:
        orm_mode = True

class DeviceBase(BaseModel):
    device_info: Annotated[str, Field(min_length=3, max_length=255, strip_whitespace=True, strict=True)]
    ip_address: Annotated[str, Field(
        regex=r"^\d{1,3}(\.\d{1,3}){3}$", min_length=7, max_length=15, strict=True
    )] 

class DeviceCreate(DeviceBase):
    pass 

class Device(DeviceBase):
    id: Annotated[int, Field(strict=True)]  
    user_id: Annotated[int, Field(strict=True)]

    class Config:
        orm_mode = True  

class Token(BaseModel):
    access_token: Annotated[str, Field(strict=True)] 
    token_type: Annotated[str, Field(strict=True)] 

class TokenData(BaseModel):
    id: Annotated[int, Field(strict=True)]  
    username: Annotated[str, Field(min_length=3, max_length=50, strip_whitespace=True, strict=True)]
