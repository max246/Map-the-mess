"""CommunityPost model — owner updates posted to a community page."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from app.database import Base


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(
        Integer, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
