"""Pydantic schemas for litter reports and report images."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ReportImageRead(BaseModel):
    id: uuid.UUID
    url: str
    thumbnail_url: Optional[str] = None
    image_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    report_type: str = "litter"
    description: str = ""
    what3words: Optional[str] = None


class ReportRead(BaseModel):
    id: uuid.UUID
    latitude: float
    longitude: float
    report_type: str
    description: str
    what3words: Optional[str] = None
    address: Optional[str] = None
    created_by_user_id: Optional[uuid.UUID] = None
    resolved_by_user_id: Optional[uuid.UUID] = None
    resolved_at: Optional[datetime] = None
    status: str
    created_at: datetime
    images: list[ReportImageRead] = []

    model_config = {"from_attributes": True}
