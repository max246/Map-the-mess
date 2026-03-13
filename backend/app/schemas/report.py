"""Pydantic schemas for litter reports."""

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ReportCreate(BaseModel):
    latitude: float
    longitude: float
    description: str = ""
    photo_url: Optional[str] = None
    what3words: Optional[str] = None


class ReportRead(ReportCreate):
    id: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
