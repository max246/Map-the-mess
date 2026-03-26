"""Pydantic schemas for communities, posts, and events."""

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
    id: int
    name: str
    description: str
    facebook_url: Optional[str] = None
    profile_image: Optional[str] = None
    latitude: float
    longitude: float
    radius_km: float
    owner_id: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommunityStatusUpdate(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------


class PostCreate(BaseModel):
    content: str


class PostUpdate(BaseModel):
    content: str


class PostRead(BaseModel):
    id: int
    community_id: int
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class EventCreate(BaseModel):
    description: str
    date: datetime
    meeting_latitude: float
    meeting_longitude: float
    report_ids: list[int] = []


class EventUpdate(BaseModel):
    description: Optional[str] = None
    date: Optional[datetime] = None
    meeting_latitude: Optional[float] = None
    meeting_longitude: Optional[float] = None
    report_ids: Optional[list[int]] = None


class EventRead(BaseModel):
    id: int
    community_id: int
    description: str
    date: datetime
    meeting_latitude: float
    meeting_longitude: float
    report_ids: list[int] = []
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
    id: int
    community_id: int
    user_id: int
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
