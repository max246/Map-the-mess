"""Bin model — a public litter/recycling bin location mapped by users."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class Bin(Base):
    __tablename__ = "bins"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    description = Column(String, default="")
    address = Column(String, nullable=True)
    created_by_user_id = Column(Uuid, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship(
        "User", foreign_keys=[created_by_user_id], backref="created_bins", lazy="joined"
    )
