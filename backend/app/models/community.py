"""Community model — local cleanup communities with location and moderation."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, Enum, ForeignKey, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class CommunityStatus(str, enum.Enum):
    active = "active"
    under_review = "under_review"


class Community(Base):
    __tablename__ = "communities"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, default="")
    facebook_url = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_km = Column(Float, nullable=False)
    owner_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Column[CommunityStatus] = Column(Enum(CommunityStatus), default=CommunityStatus.active, nullable=False)  # type: ignore[assignment]
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", backref="owned_communities", lazy="joined")
    posts = relationship(
        "CommunityPost", backref="community", cascade="all, delete-orphan", lazy="joined"
    )
    events = relationship(
        "CommunityEvent", backref="community", cascade="all, delete-orphan", lazy="joined"
    )
