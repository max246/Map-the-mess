"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./map_the_mess.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "images")

SUPERUSER_EMAIL = os.getenv("SUPERUSER_EMAIL", "")
SUPERUSER_PASSWORD = os.getenv("SUPERUSER_PASSWORD", "")
SUPERUSER_FULL_NAME = os.getenv("SUPERUSER_FULL_NAME", "Super User")
