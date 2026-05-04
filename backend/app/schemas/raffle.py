"""Pydantic schemas for raffles, prizes, and prize images."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Prize images
# ---------------------------------------------------------------------------


class RafflePrizeImageRead(BaseModel):
    id: uuid.UUID
    prize_id: uuid.UUID
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Prizes
# ---------------------------------------------------------------------------


class RafflePrizeCreate(BaseModel):
    title: str
    description: str = ""
    position: int = 0


class RafflePrizeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    position: Optional[int] = None


class RafflePrizeWinner(BaseModel):
    id: uuid.UUID
    full_name: str

    model_config = {"from_attributes": True}


class RaffleWinnerContact(BaseModel):
    """Admin-only winner detail with full contact info."""

    prize_id: uuid.UUID
    prize_title: str
    prize_position: int
    user_id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class RafflePrizeRead(BaseModel):
    id: uuid.UUID
    raffle_id: uuid.UUID
    title: str
    description: str
    position: int
    winner_user_id: Optional[uuid.UUID] = None
    winner: Optional[RafflePrizeWinner] = None
    images: list[RafflePrizeImageRead] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Raffle
# ---------------------------------------------------------------------------


class RaffleCreate(BaseModel):
    title: str
    description: str = ""
    end_date: datetime


class RaffleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    end_date: Optional[datetime] = None


class RaffleRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    end_date: datetime
    created_by: Optional[uuid.UUID] = None
    drawn_at: Optional[datetime] = None
    prizes: list[RafflePrizeRead] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
