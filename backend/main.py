"""Map the Mess — FastAPI Backend Entry Point"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext

from app.config import DEBUG, SUPERUSER_EMAIL, SUPERUSER_PASSWORD, SUPERUSER_FULL_NAME
from app.database import SessionLocal
from app.models.user import User, UserType
from app.routers import reports, auth, volunteers

logger = logging.getLogger("uvicorn.error")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _seed_superuser() -> None:
    """Create the superuser from env vars if it doesn't already exist."""
    if not SUPERUSER_EMAIL or not SUPERUSER_PASSWORD:
        logger.warning("SUPERUSER_EMAIL or SUPERUSER_PASSWORD not set, skipping superuser creation")
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == SUPERUSER_EMAIL).first()
        if existing:
            logger.info("Superuser already exists, skipping creation")
            return
        user = User(
            email=SUPERUSER_EMAIL,
            full_name=SUPERUSER_FULL_NAME,
            hashed_password=pwd_context.hash(SUPERUSER_PASSWORD),
            user_type=UserType.superuser,
        )
        db.add(user)
        db.commit()
        logger.info("Superuser created: %s", SUPERUSER_EMAIL)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_superuser()
    yield


app = FastAPI(
    title="Map the Mess API",
    description="Backend for the community litter reporting platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://mapthemess.uk",
        "http://mapthemess.uk",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(volunteers.router, prefix="/api/volunteers", tags=["Volunteers"])


@app.get("/")
def root():
    return {"message": "Map the Mess API is running 🗺️"}
