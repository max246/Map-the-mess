"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./map_the_mess.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "images")
IMAGES_DIR_REPORTS = os.path.join(IMAGES_DIR, "reports")
IMAGES_DIR_AVATARS = os.path.join(IMAGES_DIR, "avatars")
IMAGES_DIR_COMMUNITIES = os.path.join(IMAGES_DIR, "communities")

SUPERUSER_EMAIL = os.getenv("SUPERUSER_EMAIL", "")
SUPERUSER_PASSWORD = os.getenv("SUPERUSER_PASSWORD", "")
SUPERUSER_FULL_NAME = os.getenv("SUPERUSER_FULL_NAME", "Super User")
APP_VERSION = os.getenv("APP_VERSION", "dev")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
