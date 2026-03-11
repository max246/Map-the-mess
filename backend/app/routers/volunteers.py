"""Volunteer routes — placeholder for volunteer features."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def list_volunteers():
    return {"message": "Volunteer listing — coming soon"}


@router.post("/claim/{report_id}")
def claim_report(report_id: int):
    return {"message": f"Claiming report {report_id} — coming soon"}
