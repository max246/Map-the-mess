"""Refresh token model — opaque tokens stored server-side for token rotation."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Uuid
from sqlalchemy.orm import backref, relationship

from app.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship(
        "User",
        backref=backref("refresh_tokens", cascade="all, delete-orphan", passive_deletes=True),
    )
