"""Map the Mess — FastAPI Backend Entry Point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import reports, auth, volunteers

app = FastAPI(
    title="Map the Mess API",
    description="Backend for the community litter reporting platform",
    version="0.1.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
