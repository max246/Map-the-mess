"""UserBadge model — tracks which badges a user has earned and whether they've acknowledged them."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(String, nullable=False, index=True)
    awarded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="badge_awards", lazy="joined")
