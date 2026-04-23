"""Tests for bin endpoints (/api/bins)."""

from unittest.mock import patch

from app.models.bin import Bin
from app.models.user import UserType

from tests.api.conftest import _make_user, auth_header

UK_LAT = 51.5
UK_LON = -0.1


def _create_bin(db, user=None, **overrides) -> Bin:
    defaults = dict(latitude=UK_LAT, longitude=UK_LON, description="near the bench")
    defaults.update(overrides)
    if user is not None and "created_by_user_id" not in defaults:
        defaults["created_by_user_id"] = user.id
    bin_obj = Bin(**defaults)
    db.add(bin_obj)
    db.commit()
    db.refresh(bin_obj)
    return bin_obj


def _patch_geocode():
    return patch("app.routers.bins._reverse_geocode", return_value=None)


class TestListBins:
    def test_empty_list(self, client, db):
        res = client.get("/api/bins/")
        assert res.status_code == 200
        assert res.json() == []

    def test_lists_all_without_radius(self, client, db):
        _create_bin(db)
        _create_bin(db, latitude=53.5, longitude=-1.5)
        res = client.get("/api/bins/")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_radius_filter_excludes_far_bins(self, client, db):
        _create_bin(db, latitude=UK_LAT, longitude=UK_LON)
        _create_bin(db, latitude=55.0, longitude=-4.0)
        res = client.get(f"/api/bins/?latitude={UK_LAT}&longitude={UK_LON}&radius_km=1")
        assert res.status_code == 200
        bins = res.json()
        assert len(bins) == 1
        assert bins[0]["latitude"] == UK_LAT


class TestCreateBin:
    def test_requires_auth(self, client, db):
        res = client.post(
            "/api/bins/", json={"latitude": UK_LAT, "longitude": UK_LON, "description": "x"}
        )
        assert res.status_code == 401

    def test_create_succeeds(self, client, db, volunteer):
        with _patch_geocode():
            res = client.post(
                "/api/bins/",
                json={"latitude": UK_LAT, "longitude": UK_LON, "description": "by the shop"},
                headers=auth_header(volunteer),
            )
        assert res.status_code == 201
        data = res.json()
        assert data["latitude"] == UK_LAT
        assert data["description"] == "by the shop"
        assert data["created_by_user_id"] == str(volunteer.id)

    def test_rejects_coords_outside_uk(self, client, db, volunteer):
        with _patch_geocode():
            res = client.post(
                "/api/bins/",
                json={"latitude": 40.0, "longitude": -70.0, "description": ""},
                headers=auth_header(volunteer),
            )
        assert res.status_code == 400


class TestUpdateBin:
    def test_owner_can_edit(self, client, db, volunteer):
        bin_obj = _create_bin(db, user=volunteer)
        with _patch_geocode():
            res = client.patch(
                f"/api/bins/{bin_obj.id}",
                json={"description": "updated"},
                headers=auth_header(volunteer),
            )
        assert res.status_code == 200
        assert res.json()["description"] == "updated"

    def test_non_owner_volunteer_cannot_edit(self, client, db, volunteer):
        other = _make_user(db, email="other@example.com", user_type=UserType.volunteer)
        bin_obj = _create_bin(db, user=other)
        res = client.patch(
            f"/api/bins/{bin_obj.id}",
            json={"description": "hijack"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_moderator_can_edit_others_bin(self, client, db, moderator):
        owner = _make_user(db, email="owner@example.com", user_type=UserType.volunteer)
        bin_obj = _create_bin(db, user=owner)
        with _patch_geocode():
            res = client.patch(
                f"/api/bins/{bin_obj.id}",
                json={"description": "tidied"},
                headers=auth_header(moderator),
            )
        assert res.status_code == 200
        assert res.json()["description"] == "tidied"

    def test_admin_can_edit_others_bin(self, client, db, admin):
        owner = _make_user(db, email="owner2@example.com", user_type=UserType.volunteer)
        bin_obj = _create_bin(db, user=owner)
        with _patch_geocode():
            res = client.patch(
                f"/api/bins/{bin_obj.id}",
                json={"description": "tidied"},
                headers=auth_header(admin),
            )
        assert res.status_code == 200

    def test_404_for_missing(self, client, db, volunteer):
        res = client.patch(
            "/api/bins/00000000-0000-0000-0000-000000000000",
            json={"description": "x"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404


class TestDeleteBin:
    def test_owner_can_delete(self, client, db, volunteer):
        bin_obj = _create_bin(db, user=volunteer)
        res = client.delete(f"/api/bins/{bin_obj.id}", headers=auth_header(volunteer))
        assert res.status_code == 204
        assert db.query(Bin).filter(Bin.id == bin_obj.id).first() is None

    def test_non_owner_volunteer_cannot_delete(self, client, db, volunteer):
        other = _make_user(db, email="del-other@example.com", user_type=UserType.volunteer)
        bin_obj = _create_bin(db, user=other)
        res = client.delete(f"/api/bins/{bin_obj.id}", headers=auth_header(volunteer))
        assert res.status_code == 403

    def test_moderator_can_delete_others_bin(self, client, db, moderator):
        owner = _make_user(db, email="del-owner@example.com", user_type=UserType.volunteer)
        bin_obj = _create_bin(db, user=owner)
        res = client.delete(f"/api/bins/{bin_obj.id}", headers=auth_header(moderator))
        assert res.status_code == 204

    def test_404_for_missing(self, client, db, volunteer):
        res = client.delete(
            "/api/bins/00000000-0000-0000-0000-000000000000",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404
