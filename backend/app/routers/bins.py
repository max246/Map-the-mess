"""CRUD routes for public bin locations."""

import logging
import uuid
from math import radians
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bin import Bin
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.bin import BinCreate, BinRead, BinUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

# UK bounding box — same as reports
UK_LAT_MIN, UK_LAT_MAX = 49.9, 60.9
UK_LON_MIN, UK_LON_MAX = -8.2, 1.8


def _reverse_geocode(lat: float, lon: float) -> str | None:
    """Best-effort reverse geocode via Nominatim."""
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


def _validate_coords(latitude: float, longitude: float) -> None:
    if not (UK_LAT_MIN <= latitude <= UK_LAT_MAX and UK_LON_MIN <= longitude <= UK_LON_MAX):
        raise HTTPException(status_code=400, detail="Coordinates must be within the UK")


def _can_modify(bin_obj: Bin, user: User) -> bool:
    is_owner = bool(bin_obj.created_by_user_id == user.id)
    is_privileged = user.user_type in ("moderator", "admin", "superuser")
    return is_owner or is_privileged


@router.get("/", response_model=List[BinRead])
def list_bins(
    latitude: Optional[float] = Query(None, description="Centre latitude for radius query"),
    longitude: Optional[float] = Query(None, description="Centre longitude for radius query"),
    radius_km: float = Query(1.0, description="Radius in kilometres"),
    db: Session = Depends(get_db),
):
    """List bins, optionally filtered to those within ``radius_km`` of (latitude, longitude).

    The map only shows bins at high zoom, so the default radius is small (1 km).
    """
    q = db.query(Bin)
    if latitude is not None and longitude is not None:
        lat_r = radians(latitude)
        lon_r = radians(longitude)
        cos_expr = func.cos(func.radians(Bin.latitude)) * func.cos(lat_r) * func.cos(
            func.radians(Bin.longitude) - lon_r
        ) + func.sin(func.radians(Bin.latitude)) * func.sin(lat_r)
        # Clamp floating-point overshoot (SQLite lacks least()).
        clamped = case((cos_expr > 1.0, 1.0), else_=cos_expr)
        distance = 6371 * func.acos(clamped)
        q = q.filter(distance <= radius_km)
    return q.order_by(Bin.created_at.desc()).all()


@router.get("/{bin_id}", response_model=BinRead)
def get_bin(bin_id: uuid.UUID, db: Session = Depends(get_db)):
    bin_obj = db.query(Bin).get(bin_id)
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    return bin_obj


@router.post("/", response_model=BinRead, status_code=201)
def create_bin(
    body: BinCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new bin location. Requires authentication."""
    _validate_coords(body.latitude, body.longitude)
    address = _reverse_geocode(body.latitude, body.longitude)
    bin_obj = Bin(
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        address=address,
        created_by_user_id=current_user.id,
    )
    db.add(bin_obj)
    db.commit()
    db.refresh(bin_obj)
    return bin_obj


@router.patch("/{bin_id}", response_model=BinRead)
def update_bin(
    bin_id: uuid.UUID,
    body: BinUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a bin. Allowed for the owner, moderator, admin, or superuser."""
    bin_obj = db.query(Bin).get(bin_id)
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    if not _can_modify(bin_obj, current_user):
        raise HTTPException(status_code=403, detail="Not authorised to edit this bin")

    coords_changed = False
    if body.latitude is not None:
        bin_obj.latitude = body.latitude
        coords_changed = True
    if body.longitude is not None:
        bin_obj.longitude = body.longitude
        coords_changed = True
    if body.description is not None:
        bin_obj.description = body.description
    if coords_changed:
        _validate_coords(float(bin_obj.latitude), float(bin_obj.longitude))
        bin_obj.address = _reverse_geocode(float(bin_obj.latitude), float(bin_obj.longitude))

    db.commit()
    db.refresh(bin_obj)
    return bin_obj


@router.delete("/{bin_id}", status_code=204)
def delete_bin(
    bin_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a bin. Allowed for the owner, moderator, admin, or superuser."""
    bin_obj = db.query(Bin).get(bin_id)
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    if not _can_modify(bin_obj, current_user):
        raise HTTPException(status_code=403, detail="Not authorised to delete this bin")
    db.delete(bin_obj)
    db.commit()
