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
    cycle: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportStatusLogRead(BaseModel):
    id: uuid.UUID
    action: str
    cycle: int
    performed_by_user_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    report_type: str = "litter"
    description: str = ""
    what3words: Optional[str] = None


class ReportUpdate(BaseModel):
    description: Optional[str] = None
    report_type: Optional[str] = None
    what3words: Optional[str] = None
    remove_image_ids: Optional[list[uuid.UUID]] = None


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
    current_cycle: int = 0
    created_at: datetime
    images: list[ReportImageRead] = []
    status_log: list[ReportStatusLogRead] = []

    model_config = {"from_attributes": True}
