"""Pydantic schemas for user authentication."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    city_latitude: float
    city_longitude: float


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_verified: bool
    user_type: str
    avatar_url: str | None = None
    city_latitude: float
    city_longitude: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
    city_latitude: float | None = None
    city_longitude: float | None = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


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
    user_id: uuid.UUID
    rank: int
    name: str
    cleaned_count: int


class BadgeRead(BaseModel):
    id: str
    name: str
    description: str


class PublicProfile(BaseModel):
    name: str
    avatar_url: str | None = None
    badges: list[BadgeRead] = []
    member_since: datetime
