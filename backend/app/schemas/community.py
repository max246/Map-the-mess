"""Pydantic schemas for communities, posts, and events."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------


class CommunityCreate(BaseModel):
    name: str
    description: str = ""
    latitude: float
    longitude: float
    radius_km: float
    facebook_url: Optional[str] = None


class CommunityRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    facebook_url: Optional[str] = None
    profile_image: Optional[str] = None
    latitude: float
    longitude: float
    radius_km: float
    owner_id: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommunityStatusUpdate(BaseModel):
    status: str


class CommunityOwnerUpdate(BaseModel):
    user_id: uuid.UUID


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------


class PostCreate(BaseModel):
    content: str


class PostUpdate(BaseModel):
    content: str


class PostRead(BaseModel):
    id: uuid.UUID
    community_id: uuid.UUID
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: datetime
    meeting_latitude: float
    meeting_longitude: float
    report_ids: list[uuid.UUID] = []


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    meeting_latitude: Optional[float] = None
    meeting_longitude: Optional[float] = None
    report_ids: Optional[list[uuid.UUID]] = None


class EventRead(BaseModel):
    id: uuid.UUID
    community_id: uuid.UUID
    title: str
    description: Optional[str] = None
    date: datetime
    meeting_latitude: float
    meeting_longitude: float
    report_ids: list[uuid.UUID] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Community detail (includes posts + events)
# ---------------------------------------------------------------------------


class CommunityDetail(CommunityRead):
    posts: list[PostRead] = []
    events: list[EventRead] = []


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------


class MembershipRead(BaseModel):
    id: uuid.UUID
    community_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str = ""
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MembershipAction(BaseModel):
    """Body for approve/reject."""

    status: str  # "approved" or "rejected"


# ---------------------------------------------------------------------------
# My communities (owned + joined + pending)
# ---------------------------------------------------------------------------


class RejectedCommunity(BaseModel):
    community: CommunityRead
    rejected_at: Optional[datetime] = None


class MyCommunities(BaseModel):
    owned: list[CommunityRead] = []
    joined: list[CommunityRead] = []
    pending: list[CommunityRead] = []
    rejected: list[RejectedCommunity] = []
