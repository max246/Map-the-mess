"""User model — authenticated users with role-based access."""

import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, Integer, String, DateTime, Enum

from app.database import Base


class UserType(str, enum.Enum):
    superuser = "superuser"
    admin = "admin"
    moderator = "moderator"
    volunteer = "volunteer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    user_type: Column[UserType] = Column(Enum(UserType), default=UserType.volunteer, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
