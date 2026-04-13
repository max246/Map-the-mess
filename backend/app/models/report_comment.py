"""ReportComment model — comments on open reports by registered users."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class ReportComment(Base):
    __tablename__ = "report_comments"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    report_id = Column(Uuid, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", lazy="joined")
    report = relationship("Report", back_populates="comments")
