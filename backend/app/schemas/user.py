"""Pydantic schemas for user authentication."""

from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    is_verified: bool
    user_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateType(BaseModel):
    user_type: str


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    cleaned_count: int
