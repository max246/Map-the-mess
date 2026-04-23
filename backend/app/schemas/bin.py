"""Pydantic schemas for bin locations."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class BinCreate(BaseModel):
    latitude: float
    longitude: float
    description: str = ""


class BinUpdate(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None


class BinRead(BaseModel):
    id: uuid.UUID
    latitude: float
    longitude: float
    description: str
    address: Optional[str] = None
    created_by_user_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
