"""User model — authenticated users with role-based access."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Float, String, DateTime, Enum, Uuid

from app.database import Base


class UserType(str, enum.Enum):
    superuser = "superuser"
    admin = "admin"
    moderator = "moderator"
    volunteer = "volunteer"


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    user_type: Column[UserType] = Column(Enum(UserType), default=UserType.volunteer, nullable=False)
    avatar_url = Column(String, nullable=True)
    city_latitude = Column(Float, nullable=False, default=0.0)
    city_longitude = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
