"""CRUD routes for litter reports."""

import os
import uuid
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from PIL import Image
from fastapi.responses import FileResponse, JSONResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List, Optional

import httpx
import logging

from app.config import SECRET_KEY, IMAGES_DIR, IMAGES_DIR_REPORTS

logger = logging.getLogger(__name__)
from app.database import get_db
from app.models.report import Report, ReportStatus, ReportType
from app.models.report_image import ReportImage, ImageType
from app.models.user import User
from app.routers.auth import ALGORITHM, get_current_user, require_moderator_or_admin
from app.schemas.report import ReportRead, ReportImageRead

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_IMAGE_SIZE = (1920, 1080)
THUMBNAIL_SIZE = (400, 400)

# Bounding box for the UK (including Northern Ireland)
UK_LAT_MIN, UK_LAT_MAX = 49.9, 60.9
UK_LON_MIN, UK_LON_MAX = -8.2, 1.8

os.makedirs(IMAGES_DIR_REPORTS, exist_ok=True)


def _reverse_geocode(lat: float, lon: float) -> str | None:
    """Best-effort reverse geocode via Nominatim. Returns a display address or None."""
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lon, "format": "json", "addressdetails": "1"},
            headers={"User-Agent": "MapTheMess/1.0", "Accept-Language": "en"},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        addr = resp.json().get("address", {})
        parts = [
            addr.get("road") or addr.get("pedestrian") or addr.get("footway") or "",
            addr.get("city") or addr.get("town") or addr.get("village") or addr.get("hamlet") or "",
            addr.get("postcode") or "",
        ]
        display = ", ".join(p for p in parts if p)
        return display or None
    except Exception:
        logger.warning("Reverse geocode failed for %s, %s", lat, lon)
        return None


def _validate_report_type(raw: str) -> ReportType:
    try:
        return ReportType(raw)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report_type. Must be one of: {', '.join(t.value for t in ReportType)}",
        )


def _validate_image_type(raw: str) -> ImageType:
    try:
        return ImageType(raw)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image_type. Must be one of: {', '.join(t.value for t in ImageType)}",
        )


def _save_upload(file: UploadFile) -> tuple[str, str]:
    """Save an uploaded file as an optimised Full-HD JPEG + thumbnail. Returns (filename, thumb_filename)."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Must be one of: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    try:
        img = Image.open(BytesIO(file.file.read()))
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read image file")

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Full-HD version
    full = img.copy()
    full.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
    base = uuid.uuid4().hex
    filename = f"{base}.jpg"
    full.save(os.path.join(IMAGES_DIR_REPORTS, filename), format="JPEG", quality=85, optimize=True)

    # Thumbnail
    thumb = img.copy()
    thumb.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
    thumb_filename = f"{base}_thumb.jpg"
    thumb.save(
        os.path.join(IMAGES_DIR_REPORTS, thumb_filename), format="JPEG", quality=80, optimize=True
    )

    return filename, thumb_filename


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


def _resolve_image_path(filename: str) -> str:
    """Resolve the full filesystem path for an image based on its filename prefix."""
    if filename.startswith("avatar_"):
        return os.path.join(IMAGES_DIR, "avatars", filename)
    if filename.startswith("community_"):
        return os.path.join(IMAGES_DIR, "communities", filename)
    return os.path.join(IMAGES_DIR_REPORTS, filename)


@router.get("/images/{filename}")
def serve_image(filename: str):
    """Serve an uploaded image by filename."""
    path = _resolve_image_path(filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.get("/export")
def export_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all reports as a downloadable JSON file. Requires authentication."""
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    data = [
        {
            "id": str(r.id),
            "latitude": r.latitude,
            "longitude": r.longitude,
            "report_type": (
                r.report_type.value if hasattr(r.report_type, "value") else r.report_type
            ),
            "description": r.description,
            "what3words": r.what3words,
            "address": r.address,
            "status": r.status.value if hasattr(r.status, "value") else r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        }
        for r in reports
    ]
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": "attachment; filename=reports.json"},
    )


@router.get("/", response_model=List[ReportRead])
def list_reports(
    request: Request,
    status: str | None = None,
    report_type: str | None = None,
    radius_km: float = 30.0,
    db: Session = Depends(get_db),
):
    """List all reports, optionally filtered by status and/or report type. Authenticated users with city coordinates get nearby reports."""
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    if report_type:
        validated_type = _validate_report_type(report_type)
        q = q.filter(Report.report_type == validated_type)

    user = _get_optional_user(request, db)
    if (
        user
        and user.user_type not in ("admin", "superuser")
        and (user.city_latitude != 0 or user.city_longitude != 0)
    ):
        from sqlalchemy import func
        from math import radians

        lat_r = radians(user.city_latitude)
        lon_r = radians(user.city_longitude)
        distance = 6371 * func.acos(
            func.least(
                1.0,
                func.cos(func.radians(Report.latitude))
                * func.cos(lat_r)
                * func.cos(func.radians(Report.longitude) - lon_r)
                + func.sin(func.radians(Report.latitude)) * func.sin(lat_r),
            )
        )
        q = q.filter(distance <= radius_km)
    return q.order_by(Report.created_at.desc()).all()


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: uuid.UUID, db: Session = Depends(get_db)):
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/", response_model=ReportRead, status_code=201)
def create_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    report_type: str = Form(...),
    description: str = Form(""),
    what3words: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_user),
):
    """Create a new litter report with an optional image. Use POST /{report_id}/images for additional images."""
    validated_report_type = _validate_report_type(report_type)

    if not (UK_LAT_MIN <= latitude <= UK_LAT_MAX and UK_LON_MIN <= longitude <= UK_LON_MAX):
        raise HTTPException(status_code=400, detail="Coordinates must be within the UK")

    address = _reverse_geocode(latitude, longitude)
    report = Report(
        latitude=latitude,
        longitude=longitude,
        report_type=validated_report_type,
        description=description,
        what3words=what3words,
        address=address,
    )
    if current_user:
        report.created_by_user_id = current_user.id
    db.add(report)
    db.flush()

    if image:
        filename, thumb_filename = _save_upload(image)
        db.add(
            ReportImage(
                report_id=report.id,
                url=filename,
                thumbnail_url=thumb_filename,
                image_type=ImageType.report,
            )
        )

    db.commit()
    db.refresh(report)
    return report


@router.post("/{report_id}/images", response_model=ReportImageRead, status_code=201)
def add_image(
    report_id: uuid.UUID,
    image_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an image and attach it to an existing report."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    validated_type = _validate_image_type(image_type)
    filename, thumb_filename = _save_upload(file)
    image = ReportImage(
        report_id=report_id, url=filename, thumbnail_url=thumb_filename, image_type=validated_type
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.patch("/{report_id}/clean", response_model=ReportRead)
def mark_cleaned(
    report_id: uuid.UUID,
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
    report_id: uuid.UUID,
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


@router.delete("/images/{image_id}", status_code=204)
def delete_image(
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_moderator_or_admin),
):
    """Delete an image. If it was a resolved image, re-open the report to pending."""
    image = db.query(ReportImage).get(image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    report = db.query(Report).get(image.report_id)
    was_resolved_image = image.image_type == ImageType.resolved

    # Remove files from disk
    for fname in (image.url, image.thumbnail_url):
        if fname:
            path = _resolve_image_path(fname)
            if os.path.isfile(path):
                os.remove(path)

    db.delete(image)

    # If we deleted a resolved image and no other resolved images remain, re-open the report
    if was_resolved_image and report:
        remaining = (
            db.query(ReportImage)
            .filter(
                ReportImage.report_id == report.id,
                ReportImage.id != image_id,
                ReportImage.image_type == ImageType.resolved,
            )
            .count()
        )
        if remaining == 0:
            report.status = ReportStatus.pending
            report.resolved_at = None
            report.resolved_by_user_id = None

    db.commit()


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_moderator_or_admin),
):
    """Delete a report. Requires moderator or admin role."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    # Remove image files from disk
    for img in report.images:
        for fname in (img.url, img.thumbnail_url):
            if fname:
                path = os.path.join(IMAGES_DIR, fname)
                if os.path.isfile(path):
                    os.remove(path)
    db.delete(report)
    db.commit()
