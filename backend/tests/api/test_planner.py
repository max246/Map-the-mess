"""Tests for the planner endpoints (/api/planner) with bin drop-offs."""

from unittest.mock import MagicMock, patch

from app.models.bin import Bin
from app.models.planner import PlanBin, PlanReport
from app.models.report import Report, ReportType

from tests.api.conftest import auth_header

UK_LAT = 51.5
UK_LON = -0.1


def _create_report(db, **overrides) -> Report:
    defaults = dict(
        latitude=UK_LAT, longitude=UK_LON, report_type=ReportType.litter, description="litter"
    )
    defaults.update(overrides)
    r = Report(**defaults)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _create_bin(db, **overrides) -> Bin:
    defaults = dict(latitude=UK_LAT + 0.002, longitude=UK_LON + 0.002, description="bin")
    defaults.update(overrides)
    b = Bin(**defaults)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def _mock_osrm(num_inputs: int) -> MagicMock:
    """Build a fake OSRM /trip response for *num_inputs* input waypoints (reports + bins)."""
    # OSRM optimised order: keep input order (waypoint_index == input position).
    # Start waypoint is index 0, inputs are 1..N.
    waypoints = [{"waypoint_index": 0}]
    waypoints += [{"waypoint_index": i + 1} for i in range(num_inputs)]
    legs = [{"distance": 100.0 * (i + 1), "duration": 60.0 * (i + 1)} for i in range(num_inputs)]
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "code": "Ok",
        "waypoints": waypoints,
        "trips": [
            {
                "distance": sum(l["distance"] for l in legs),
                "duration": sum(l["duration"] for l in legs),
                "geometry": {"type": "LineString", "coordinates": [[UK_LON, UK_LAT]]},
                "legs": legs,
            }
        ],
    }
    return resp


class TestCreatePlanWithBins:
    def test_creates_plan_bins_with_visit_order(self, client, db, volunteer):
        r1 = _create_report(db, description="r1")
        r2 = _create_report(db, description="r2")
        b1 = _create_bin(db, description="b1")

        with patch("app.routers.planner.httpx.get", return_value=_mock_osrm(3)):
            res = client.post(
                "/api/planner/",
                json={
                    "report_ids": [str(r1.id), str(r2.id)],
                    "bin_ids": [str(b1.id)],
                    "start_latitude": UK_LAT,
                    "start_longitude": UK_LON,
                    "name": "Test plan",
                },
                headers=auth_header(volunteer),
            )
        assert res.status_code == 201, res.text
        data = res.json()
        assert len(data["plan_reports"]) == 2
        assert len(data["plan_bins"]) == 1
        assert data["plan_bins"][0]["visit_order"] == 3  # bin is last input → last optimized pos
        assert data["plan_bins"][0]["bin"]["id"] == str(b1.id)

        plan_bins = db.query(PlanBin).all()
        plan_reports = db.query(PlanReport).all()
        assert len(plan_bins) == 1
        assert len(plan_reports) == 2
        assert plan_bins[0].visit_order == 3

    def test_plan_works_without_bins(self, client, db, volunteer):
        r1 = _create_report(db)
        with patch("app.routers.planner.httpx.get", return_value=_mock_osrm(1)):
            res = client.post(
                "/api/planner/",
                json={
                    "report_ids": [str(r1.id)],
                    "start_latitude": UK_LAT,
                    "start_longitude": UK_LON,
                },
                headers=auth_header(volunteer),
            )
        assert res.status_code == 201
        assert res.json()["plan_bins"] == []

    def test_rejects_unknown_bin_id(self, client, db, volunteer):
        r1 = _create_report(db)
        fake_bin_id = "00000000-0000-0000-0000-000000000000"
        res = client.post(
            "/api/planner/",
            json={
                "report_ids": [str(r1.id)],
                "bin_ids": [fake_bin_id],
                "start_latitude": UK_LAT,
                "start_longitude": UK_LON,
            },
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404

    def test_rejects_too_many_bins(self, client, db, volunteer):
        r1 = _create_report(db)
        bin_ids = [str(_create_bin(db).id) for _ in range(6)]
        res = client.post(
            "/api/planner/",
            json={
                "report_ids": [str(r1.id)],
                "bin_ids": bin_ids,
                "start_latitude": UK_LAT,
                "start_longitude": UK_LON,
            },
            headers=auth_header(volunteer),
        )
        assert res.status_code == 422


class TestGpxIncludesBins:
    def test_gpx_includes_bin_waypoints(self, client, db, volunteer):
        r1 = _create_report(db, description="r1")
        b1 = _create_bin(db, description="behind the bench")
        with patch("app.routers.planner.httpx.get", return_value=_mock_osrm(2)):
            created = client.post(
                "/api/planner/",
                json={
                    "report_ids": [str(r1.id)],
                    "bin_ids": [str(b1.id)],
                    "start_latitude": UK_LAT,
                    "start_longitude": UK_LON,
                },
                headers=auth_header(volunteer),
            )
        plan_id = created.json()["id"]
        res = client.get(f"/api/planner/{plan_id}/export.gpx", headers=auth_header(volunteer))
        assert res.status_code == 200
        body = res.text
        assert "bin" in body.lower()
        assert "behind the bench" in body
