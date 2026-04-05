#!/usr/bin/env python3
"""Local development helper — seed users, wipe reports, or reset the database.

Usage:
    python utils/dev_seed.py users          # create 5 random volunteers (prints credentials)
    python utils/dev_seed.py wipe-reports   # delete all reports and their images
    python utils/dev_seed.py wipe-users     # delete all users except the superuser
    python utils/dev_seed.py reset          # all of the above (wipe everything, then seed users)
"""

import argparse
import os
import random
import string
import sys

# Ensure the backend package is importable
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND_DIR)

# Load .env from project root and build DATABASE_URL for local access
PROJECT_ROOT = os.path.join(BACKEND_DIR, "..")
_env_path = os.path.join(PROJECT_ROOT, ".env")
if os.path.isfile(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

# Build DATABASE_URL from .env vars if not already set (localhost:5433 for Docker-exposed Postgres)
if not os.environ.get("DATABASE_URL"):
    pg_user = os.environ.get("POSTGRES_USER", "")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "")
    pg_db = os.environ.get("POSTGRES_DB", "")
    if pg_user and pg_pass and pg_db:
        os.environ["DATABASE_URL"] = f"postgresql://{pg_user}:{pg_pass}@localhost:5433/{pg_db}"

from passlib.context import CryptContext

from app.database import SessionLocal
from app.models.user import User, UserType
from app.models.report import Report
from app.models.report_image import ReportImage
from app.models.favourite import Favourite
from app.models.refresh_token import RefreshToken

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

FIRST_NAMES = ["Alice", "Bob", "Charlie", "Dana", "Eli"]
LAST_NAMES = ["Smith", "Jones", "Taylor", "Brown", "Wilson"]


def _random_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def seed_users(db, count: int = 5) -> None:
    """Create random volunteer accounts and print their credentials."""
    print(f"\nCreating {count} volunteer accounts...\n")
    print(f"{'Email':<35} {'Password':<15} {'Name'}")
    print("-" * 70)

    for i in range(count):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[i % len(LAST_NAMES)]
        email = f"{first.lower()}.{last.lower()}@example.com"
        password = _random_password()

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.hashed_password = pwd_context.hash(password)
            existing.is_verified = True
            db.commit()
            print(f"{email:<35} {password:<15} {first} {last}  (updated)")
        else:
            db.add(
                User(
                    email=email,
                    full_name=f"{first} {last}",
                    hashed_password=pwd_context.hash(password),
                    is_verified=True,
                    user_type=UserType.volunteer,
                )
            )
            print(f"{email:<35} {password:<15} {first} {last}")

    db.commit()
    print(f"\nDone — {count} volunteers ready to log in.\n")


def wipe_reports(db) -> None:
    """Delete all reports (cascades to images and favourites)."""
    count = db.query(Report).count()
    db.query(Favourite).delete()
    db.query(ReportImage).delete()
    db.query(Report).delete()
    db.commit()
    print(f"Deleted {count} reports (and their images/favourites).")


def wipe_users(db) -> None:
    """Delete all users except the superuser."""
    count = db.query(User).filter(User.user_type != UserType.superuser).count()
    # Clean up refresh tokens for non-superusers
    non_super_ids = [
        uid for (uid,) in db.query(User.id).filter(User.user_type != UserType.superuser).all()
    ]
    if non_super_ids:
        db.query(RefreshToken).filter(RefreshToken.user_id.in_(non_super_ids)).delete(
            synchronize_session=False
        )
        db.query(Favourite).filter(Favourite.user_id.in_(non_super_ids)).delete(
            synchronize_session=False
        )
    db.query(User).filter(User.user_type != UserType.superuser).delete(synchronize_session=False)
    db.commit()
    print(f"Deleted {count} users (superuser kept).")


def verify_user(db, email: str) -> None:
    """Mark a user as verified by email address."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"No user found with email: {email}")
        sys.exit(1)
    if user.is_verified:
        print(f"{email} is already verified.")
        return
    user.is_verified = True
    db.commit()
    print(f"{email} is now verified.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Local dev helper — seed users, wipe reports, or reset the database."
    )
    parser.add_argument(
        "command",
        choices=["users", "wipe-reports", "wipe-users", "reset", "verify"],
        help="Action to perform",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of users to create (default: 5)",
    )
    parser.add_argument(
        "--email",
        type=str,
        help="Email address for the verify command",
    )
    args = parser.parse_args()

    from app.config import DATABASE_URL

    print(f"Using database: {DATABASE_URL}\n")

    db = SessionLocal()
    try:
        if args.command == "users":
            seed_users(db, args.count)
        elif args.command == "wipe-reports":
            wipe_reports(db)
        elif args.command == "wipe-users":
            wipe_users(db)
        elif args.command == "verify":
            if not args.email:
                print("Usage: python utils/dev_seed.py verify --email user@example.com")
                sys.exit(1)
            verify_user(db, args.email)
        elif args.command == "reset":
            wipe_reports(db)
            wipe_users(db)
            seed_users(db, args.count)
    finally:
        db.close()


if __name__ == "__main__":
    main()
