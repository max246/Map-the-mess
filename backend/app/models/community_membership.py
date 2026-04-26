"""CommunityMembership model — tracks users joining communities with approval workflow."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import backref, relationship

from app.database import Base


class MembershipStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CommunityMembership(Base):
    __tablename__ = "community_memberships"
    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_user"),)

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    community_id = Column(
        Uuid, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Column[MembershipStatus] = Column(Enum(MembershipStatus), default=MembershipStatus.pending, nullable=False)  # type: ignore[assignment]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    community = relationship("Community", backref="memberships", lazy="joined")
    user = relationship(
        "User",
        backref=backref(
            "community_memberships", cascade="all, delete-orphan", passive_deletes=True
        ),
        lazy="joined",
    )
