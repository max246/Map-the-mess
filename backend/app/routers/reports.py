"""CRUD routes for litter reports."""

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List, Optional

from app.config import SECRET_KEY, IMAGES_DIR
from app.database import get_db
from app.models.report import Report, ReportStatus
from app.models.report_image import ReportImage, ImageType
from app.models.user import User
from app.routers.auth import ALGORITHM, require_moderator_or_admin
from app.schemas.report import ReportRead, ReportImageRead

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

os.makedirs(IMAGES_DIR, exist_ok=True)


def _validate_image_type(raw: str) -> ImageType:
    try:
        return ImageType(raw)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image_type. Must be one of: {', '.join(t.value for t in ImageType)}",
        )


def _save_upload(file: UploadFile) -> str:
    """Save an uploaded file to IMAGES_DIR and return the filename."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Must be one of: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(IMAGES_DIR, filename)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return filename


def _get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    """Return the logged-in user if a valid token is present, otherwise None."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.email == email).first()


@router.get("/images/{filename}")
def serve_image(filename: str):
    """Serve an uploaded image by filename."""
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.get("/", response_model=List[ReportRead])
def list_reports(status: str | None = None, db: Session = Depends(get_db)):
    """List all reports, optionally filtered by status."""
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    return q.order_by(Report.created_at.desc()).all()


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/", response_model=ReportRead, status_code=201)
def create_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str = Form(""),
    what3words: Optional[str] = Form(None),
    images: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_user),
):
    """Create a new litter report with optional image uploads."""
    report = Report(
        latitude=latitude,
        longitude=longitude,
        description=description,
        what3words=what3words,
    )
    if current_user:
        report.created_by_user_id = current_user.id
    db.add(report)
    db.flush()

    for file in images:
        filename = _save_upload(file)
        db.add(
            ReportImage(
                report_id=report.id,
                url=filename,
                image_type=ImageType.report,
            )
        )

    db.commit()
    db.refresh(report)
    return report


@router.post("/{report_id}/images", response_model=ReportImageRead, status_code=201)
def add_image(
    report_id: int,
    image_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an image and attach it to an existing report."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    validated_type = _validate_image_type(image_type)
    filename = _save_upload(file)
    image = ReportImage(report_id=report_id, url=filename, image_type=validated_type)
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.patch("/{report_id}/clean", response_model=ReportRead)
def mark_cleaned(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_user),
):
    """Mark a report as cleaned. Attaches the user id if authenticated."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = ReportStatus.cleaned
    report.resolved_at = datetime.now(timezone.utc)
    if current_user:
        report.resolved_by_user_id = current_user.id
    db.commit()
    db.refresh(report)
    return report


@router.patch("/{report_id}/unresolve", response_model=ReportRead)
def mark_unresolved(
    report_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_moderator_or_admin),
):
    """Set a report back to pending. Requires moderator or admin role."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = ReportStatus.pending
    report.resolved_at = None
    report.resolved_by_user_id = None
    db.commit()
    db.refresh(report)
    return report


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_moderator_or_admin),
):
    """Delete a report. Requires moderator or admin role."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    # Remove image files from disk
    for img in report.images:
        path = os.path.join(IMAGES_DIR, img.url)
        if os.path.isfile(path):
            os.remove(path)
    db.delete(report)
    db.commit()
