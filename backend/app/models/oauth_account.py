"""OAuth account model — links a user to an external identity provider."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Uuid, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_oauth_provider_account"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    provider_account_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="oauth_accounts")
