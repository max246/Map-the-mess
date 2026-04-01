"""CommunityPost model — owner updates posted to a community page."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Uuid

from app.database import Base


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    community_id = Column(
        Uuid, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
