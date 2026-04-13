"""Pydantic schemas for the volunteer route planner."""

import json
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import quote

from pydantic import BaseModel, field_validator

from app.schemas.report import ReportRead


class PlanCreate(BaseModel):
    report_ids: list[uuid.UUID]
    start_latitude: float
    start_longitude: float
    name: Optional[str] = None

    @field_validator("report_ids")
    @classmethod
    def validate_report_ids(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(v) < 1:
            raise ValueError("At least one report is required")
        if len(v) > 10:
            raise ValueError("A plan can contain at most 10 reports")
        if len(set(v)) != len(v):
            raise ValueError("Duplicate report IDs are not allowed")
        return v


class PlanUpdate(BaseModel):
    name: Optional[str] = None


class PlanReportRead(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    visit_order: int
    leg_distance_meters: Optional[float] = None
    leg_duration_seconds: Optional[float] = None
    report: ReportRead

    model_config = {"from_attributes": True}


class PlanRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: Optional[str] = None
    start_latitude: float
    start_longitude: float
    status: str
    total_distance_meters: Optional[float] = None
    total_duration_seconds: Optional[float] = None
    route_geometry: Optional[dict] = None
    google_maps_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    plan_reports: list[PlanReportRead] = []

    model_config = {"from_attributes": True}

    @field_validator("route_geometry", mode="before")
    @classmethod
    def parse_route_geometry(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("google_maps_url", mode="before")
    @classmethod
    def build_google_maps_url(cls, v, info):
        # Computed from plan data in the router, not from the DB
        return v


class PlanListRead(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    start_latitude: float
    start_longitude: float
    status: str
    total_distance_meters: Optional[float] = None
    total_duration_seconds: Optional[float] = None
    report_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
