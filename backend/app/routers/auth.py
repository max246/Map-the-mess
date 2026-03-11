"""Auth routes — placeholder for future authentication."""

from fastapi import APIRouter

router = APIRouter()


@router.post("/register")
def register():
    return {"message": "Registration endpoint — coming soon"}


@router.post("/login")
def login():
    return {"message": "Login endpoint — coming soon"}
