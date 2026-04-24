"""Planner routes — optimised walking routes through selected reports."""

import json
import logging
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import OSRM_URL
from app.database import get_db
from app.models.bin import Bin
from app.models.planner import Plan, PlanBin, PlanReport, PlanStatus
from app.models.report import Report
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.planner import PlanCreate, PlanListRead, PlanRead, PlanUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# OSRM helper
# ---------------------------------------------------------------------------


def _call_osrm_trip(
    start_lon: float,
    start_lat: float,
    waypoints: list[tuple[float, float]],
) -> dict:
    """Call OSRM /trip to get an optimised walking route.

    *waypoints* is a list of ``(longitude, latitude)`` tuples for the reports.
    Returns the parsed OSRM JSON response.
    """
    coords = f"{start_lon},{start_lat}" + ";" + ";".join(f"{lon},{lat}" for lon, lat in waypoints)
    url = (
        f"{OSRM_URL}/trip/v1/foot/{coords}"
        "?source=first&roundtrip=false&geometries=geojson&overview=full&steps=false"
    )
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": "MapTheMess/1.0"},
            timeout=10,
        )
    except Exception:
        logger.warning("OSRM request failed for trip with %d waypoints", len(waypoints))
        raise HTTPException(
            status_code=502, detail="Route optimisation service is temporarily unavailable"
        )

    if resp.status_code != 200:
        logger.warning("OSRM returned HTTP %d", resp.status_code)
        raise HTTPException(status_code=502, detail="Route optimisation service returned an error")

    data = resp.json()
    if data.get("code") != "Ok":
        logger.warning("OSRM code: %s", data.get("code"))
        raise HTTPException(
            status_code=502,
            detail=f"Route optimisation failed: {data.get('code', 'unknown')}",
        )
    return data


# ---------------------------------------------------------------------------
# Google Maps URL builder
# ---------------------------------------------------------------------------


def _build_google_maps_url(plan: Plan) -> str:
    """Build a Google Maps Directions URL from the plan's ordered waypoints (reports + bins)."""
    stops: list[tuple[int, float, float]] = []
    for pr in plan.plan_reports:
        stops.append((int(pr.visit_order), float(pr.report.latitude), float(pr.report.longitude)))
    for pb in plan.plan_bins:
        stops.append((int(pb.visit_order), float(pb.bin.latitude), float(pb.bin.longitude)))
    stops.sort(key=lambda s: s[0])
    if not stops:
        return ""

    origin = f"{plan.start_latitude},{plan.start_longitude}"
    destination = f"{stops[-1][1]},{stops[-1][2]}"

    url = (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={origin}"
        f"&destination={destination}"
        f"&travelmode=walking"
    )

    if len(stops) > 1:
        waypoints = "|".join(f"{lat},{lon}" for _, lat, lon in stops[:-1])
        url += f"&waypoints={waypoints}"

    return url


# ---------------------------------------------------------------------------
# Ownership check helper
# ---------------------------------------------------------------------------


def _get_user_plan(plan_id: uuid.UUID, user: User, db: Session) -> Plan:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorised to access this plan")
    return plan


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=PlanRead, status_code=201)
def create_plan(
    body: PlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new walking plan with OSRM-optimised route.

    Both reports and optional bin drop-offs are treated as OSRM waypoints and
    interleaved in the optimised order.
    """
    # Fetch reports
    reports = db.query(Report).filter(Report.id.in_(body.report_ids)).all()
    if len(reports) != len(body.report_ids):
        found_ids = {r.id for r in reports}
        missing = [str(rid) for rid in body.report_ids if rid not in found_ids]
        raise HTTPException(status_code=404, detail=f"Reports not found: {', '.join(missing)}")
    report_by_id: dict[uuid.UUID, Report] = {r.id: r for r in reports}  # type: ignore[misc]
    ordered_reports = [report_by_id[rid] for rid in body.report_ids]

    # Fetch optional bins
    ordered_bins: list[Bin] = []
    if body.bin_ids:
        bins = db.query(Bin).filter(Bin.id.in_(body.bin_ids)).all()
        if len(bins) != len(body.bin_ids):
            found_ids = {b.id for b in bins}
            missing = [str(bid) for bid in body.bin_ids if bid not in found_ids]
            raise HTTPException(status_code=404, detail=f"Bins not found: {', '.join(missing)}")
        bin_by_id: dict[uuid.UUID, Bin] = {b.id: b for b in bins}  # type: ignore[misc]
        ordered_bins = [bin_by_id[bid] for bid in body.bin_ids]

    # Call OSRM with reports first, then bins (order matters for demuxing below)
    waypoints_lonlat: list[tuple[float, float]] = [
        (float(r.longitude), float(r.latitude)) for r in ordered_reports
    ] + [(float(b.longitude), float(b.latitude)) for b in ordered_bins]
    osrm_data = _call_osrm_trip(body.start_longitude, body.start_latitude, waypoints_lonlat)

    trip = osrm_data["trips"][0]
    osrm_waypoints = osrm_data["waypoints"]
    legs = trip["legs"]

    # osrm_waypoints[0] is the start; [1..] correspond to input waypoints in input order.
    # Input indices 1..N are reports, N+1..N+M are bins.
    n_reports = len(ordered_reports)
    trip_pos_to_report: dict[int, Report] = {}
    trip_pos_to_bin: dict[int, Bin] = {}
    for i, wp in enumerate(osrm_waypoints[1:]):
        if i < n_reports:
            trip_pos_to_report[wp["waypoint_index"]] = ordered_reports[i]
        else:
            trip_pos_to_bin[wp["waypoint_index"]] = ordered_bins[i - n_reports]

    # Create Plan
    plan = Plan(
        user_id=current_user.id,
        name=body.name,
        start_latitude=body.start_latitude,
        start_longitude=body.start_longitude,
        total_distance_meters=trip["distance"],
        total_duration_seconds=trip["duration"],
        route_geometry=json.dumps(trip["geometry"]),
    )

    # Create PlanReport / PlanBin entries with optimised visit order
    for trip_pos, report in trip_pos_to_report.items():
        leg = legs[trip_pos - 1] if 1 <= trip_pos <= len(legs) else None
        plan.plan_reports.append(
            PlanReport(
                report_id=report.id,
                visit_order=trip_pos,
                leg_distance_meters=leg["distance"] if leg else None,
                leg_duration_seconds=leg["duration"] if leg else None,
            )
        )
    for trip_pos, bin_obj in trip_pos_to_bin.items():
        leg = legs[trip_pos - 1] if 1 <= trip_pos <= len(legs) else None
        plan.plan_bins.append(
            PlanBin(
                bin_id=bin_obj.id,
                visit_order=trip_pos,
                leg_distance_meters=leg["distance"] if leg else None,
                leg_duration_seconds=leg["duration"] if leg else None,
            )
        )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    # Build response with computed google_maps_url
    result = PlanRead.model_validate(plan)
    result.google_maps_url = _build_google_maps_url(plan)
    return result


@router.get("/", response_model=list[PlanListRead])
def list_plans(
    status: Optional[str] = Query(None, description="Filter by plan status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's plans."""
    q = db.query(Plan).filter(Plan.user_id == current_user.id)
    if status:
        q = q.filter(Plan.status == status)
    return q.order_by(Plan.created_at.desc()).all()


@router.get("/{plan_id}", response_model=PlanRead)
def get_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single plan with full route details."""
    plan = _get_user_plan(plan_id, current_user, db)
    result = PlanRead.model_validate(plan)
    result.google_maps_url = _build_google_maps_url(plan)
    return result


@router.patch("/{plan_id}", response_model=PlanRead)
def update_plan(
    plan_id: uuid.UUID,
    body: PlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a plan's details (e.g. name)."""
    plan = _get_user_plan(plan_id, current_user, db)
    if body.name is not None:
        plan.name = body.name  # type: ignore[assignment]
    plan.updated_at = datetime.utcnow()  # type: ignore[assignment]
    db.commit()
    db.refresh(plan)
    result = PlanRead.model_validate(plan)
    result.google_maps_url = _build_google_maps_url(plan)
    return result


@router.patch("/{plan_id}/start", response_model=PlanRead)
def start_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a plan as in-progress."""
    plan = _get_user_plan(plan_id, current_user, db)
    if plan.status != PlanStatus.planned:
        raise HTTPException(status_code=400, detail="Plan is already started or completed")
    plan.status = PlanStatus.in_progress  # type: ignore[assignment]
    plan.updated_at = datetime.utcnow()  # type: ignore[assignment]
    db.commit()
    db.refresh(plan)
    result = PlanRead.model_validate(plan)
    result.google_maps_url = _build_google_maps_url(plan)
    return result


@router.patch("/{plan_id}/complete", response_model=PlanRead)
def complete_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a plan as completed."""
    plan = _get_user_plan(plan_id, current_user, db)
    if plan.status != PlanStatus.in_progress:
        raise HTTPException(status_code=400, detail="Plan must be in progress to complete")
    plan.status = PlanStatus.completed  # type: ignore[assignment]
    plan.updated_at = datetime.utcnow()  # type: ignore[assignment]
    db.commit()
    db.refresh(plan)
    result = PlanRead.model_validate(plan)
    result.google_maps_url = _build_google_maps_url(plan)
    return result


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a plan."""
    plan = _get_user_plan(plan_id, current_user, db)
    db.delete(plan)
    db.commit()


# ---------------------------------------------------------------------------
# GPX export
# ---------------------------------------------------------------------------


@router.get("/{plan_id}/export.gpx")
def export_gpx(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a plan as a downloadable GPX file."""
    plan = _get_user_plan(plan_id, current_user, db)
    # Merge reports + bins, sorted by visit order
    stops: list[tuple[int, str, float, float, str | None]] = []
    for pr in plan.plan_reports:
        r = pr.report
        stops.append(
            (
                int(pr.visit_order),
                f"Stop {pr.visit_order}: {r.report_type}",
                float(r.latitude),
                float(r.longitude),
                str(r.description) if r.description else None,
            )
        )
    for pb in plan.plan_bins:
        b = pb.bin
        stops.append(
            (
                int(pb.visit_order),
                f"Stop {pb.visit_order}: bin",
                float(b.latitude),
                float(b.longitude),
                str(b.description) if b.description else None,
            )
        )
    stops.sort(key=lambda s: s[0])

    gpx = ET.Element(
        "gpx",
        {
            "version": "1.1",
            "creator": "MapTheMess",
            "xmlns": "http://www.topografix.com/GPX/1/1",
        },
    )

    # Metadata
    metadata = ET.SubElement(gpx, "metadata")
    ET.SubElement(metadata, "name").text = str(plan.name) if plan.name else "Map the Mess Plan"
    ET.SubElement(metadata, "time").text = plan.created_at.isoformat() + "Z"

    # Start waypoint
    wpt = ET.SubElement(
        gpx,
        "wpt",
        {
            "lat": str(plan.start_latitude),
            "lon": str(plan.start_longitude),
        },
    )
    ET.SubElement(wpt, "name").text = "Start"

    # Stop waypoints (reports + bins, in route order)
    for _, name, lat, lon, desc in stops:
        wpt = ET.SubElement(
            gpx,
            "wpt",
            {"lat": str(lat), "lon": str(lon)},
        )
        ET.SubElement(wpt, "name").text = name
        if desc:
            ET.SubElement(wpt, "desc").text = desc

    # Route track from stored geometry
    if plan.route_geometry:
        geometry = (
            json.loads(plan.route_geometry)
            if isinstance(plan.route_geometry, str)
            else plan.route_geometry
        )
        coords = geometry.get("coordinates", [])
        if coords:
            trk = ET.SubElement(gpx, "trk")
            ET.SubElement(trk, "name").text = str(plan.name) if plan.name else "Walking Route"
            trkseg = ET.SubElement(trk, "trkseg")
            for coord in coords:
                # GeoJSON is [lon, lat], GPX uses lat/lon attributes
                ET.SubElement(
                    trkseg,
                    "trkpt",
                    {
                        "lat": str(coord[1]),
                        "lon": str(coord[0]),
                    },
                )

    xml_bytes = ET.tostring(gpx, encoding="unicode", xml_declaration=True)
    filename = f"plan-{plan.id}.gpx"
    return Response(
        content=xml_bytes,
        media_type="application/gpx+xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
