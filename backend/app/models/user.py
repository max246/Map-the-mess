"""User model — authenticated users with role-based access."""

import enum
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Enum

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
    user_type = Column(Enum(UserType), default=UserType.volunteer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
