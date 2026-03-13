"""Pydantic schemas for litter reports and report images."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ReportImageRead(BaseModel):
    id: int
    url: str
    image_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    description: str = ""
    what3words: Optional[str] = None


class ReportRead(BaseModel):
    id: int
    latitude: float
    longitude: float
    description: str
    what3words: Optional[str] = None
    created_by_user_id: Optional[int] = None
    resolved_by_user_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    status: str
    created_at: datetime
    images: list[ReportImageRead] = []

    model_config = {"from_attributes": True}
