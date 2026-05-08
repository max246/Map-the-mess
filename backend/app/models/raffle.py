"""Raffle models — admin-created raffles with prizes drawn from the user pool."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class Raffle(Base):
    __tablename__ = "raffles"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="", nullable=False)
    end_date = Column(DateTime, nullable=False)
    created_by = Column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    drawn_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prizes = relationship(
        "RafflePrize",
        backref="raffle",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="RafflePrize.position",
    )


class RafflePrize(Base):
    __tablename__ = "raffle_prizes"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    raffle_id = Column(
        Uuid, ForeignKey("raffles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String, nullable=False)
    description = Column(String, default="", nullable=False)
    position = Column(Integer, nullable=False, default=0, server_default="0")
    winner_user_id = Column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    images = relationship(
        "RafflePrizeImage",
        backref="prize",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    winner = relationship("User", foreign_keys=[winner_user_id], lazy="joined")


class RafflePrizeImage(Base):
    __tablename__ = "raffle_prize_images"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    prize_id = Column(
        Uuid, ForeignKey("raffle_prizes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
