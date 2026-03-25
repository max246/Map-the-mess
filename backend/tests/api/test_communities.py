"""Tests for community endpoints (/api/communities)."""

from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import patch

from PIL import Image as PILImage

from app.models.community import Community, CommunityStatus
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.community_post import CommunityPost
from app.models.community_event import CommunityEvent, event_reports
from app.models.report import Report, ReportStatus
from app.models.user import UserType

from tests.api.conftest import auth_header, _make_user

UK_LAT = 51.5
UK_LON = -0.1


def _create_community(db, owner, **overrides) -> Community:
    defaults = dict(
        name="Test Community",
        description="A test community",
        latitude=UK_LAT,
        longitude=UK_LON,
        radius_km=5.0,
        owner_id=owner.id,
    )
    defaults.update(overrides)
    community = Community(**defaults)
    db.add(community)
    db.commit()
    db.refresh(community)
    return community


def _create_report(db, **overrides) -> Report:
    defaults = dict(latitude=UK_LAT, longitude=UK_LON, description="litter")
    defaults.update(overrides)
    report = Report(**defaults)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def _make_upload_image() -> BytesIO:
    """Create a small in-memory JPEG for upload tests."""
    buf = BytesIO()
    img = PILImage.new("RGB", (600, 600), color="red")
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Community CRUD
# ---------------------------------------------------------------------------


class TestCreateCommunity:
    def test_create_success(self, client, db, volunteer):
        res = client.post(
            "/api/communities/",
            json={
                "name": "Cleanup Crew",
                "description": "Local cleanup group",
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "radius_km": 10.0,
                "facebook_url": "https://facebook.com/cleanupcrew",
            },
            headers=auth_header(volunteer),
        )
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Cleanup Crew"
        assert data["owner_id"] == volunteer.id
        assert data["status"] == "active"
        assert data["facebook_url"] == "https://facebook.com/cleanupcrew"

    def test_create_unauthenticated(self, client, db):
        res = client.post(
            "/api/communities/",
            json={
                "name": "No Auth",
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "radius_km": 5.0,
            },
        )
        assert res.status_code == 401

    def test_create_duplicate_name(self, client, db, volunteer):
        _create_community(db, volunteer, name="Unique Name")
        res = client.post(
            "/api/communities/",
            json={
                "name": "Unique Name",
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "radius_km": 5.0,
            },
            headers=auth_header(volunteer),
        )
        assert res.status_code == 409


class TestListCommunities:
    def test_anon_sees_only_active(self, client, db, volunteer):
        _create_community(db, volunteer, name="Active One")
        _create_community(db, volunteer, name="Blocked One", status=CommunityStatus.under_review)
        res = client.get("/api/communities/")
        assert res.status_code == 200
        names = [c["name"] for c in res.json()]
        assert "Active One" in names
        assert "Blocked One" not in names

    def test_owner_sees_own_under_review(self, client, db, volunteer):
        _create_community(db, volunteer, name="My Blocked", status=CommunityStatus.under_review)
        res = client.get("/api/communities/", headers=auth_header(volunteer))
        names = [c["name"] for c in res.json()]
        assert "My Blocked" in names

    def test_moderator_sees_all(self, client, db, volunteer, moderator):
        _create_community(db, volunteer, name="Active")
        _create_community(db, volunteer, name="Under Review", status=CommunityStatus.under_review)
        res = client.get("/api/communities/", headers=auth_header(moderator))
        names = [c["name"] for c in res.json()]
        assert "Active" in names
        assert "Under Review" in names

    def test_search_by_name(self, client, db, volunteer):
        _create_community(db, volunteer, name="Beach Cleanup")
        _create_community(db, volunteer, name="Park Rangers")
        res = client.get("/api/communities/?search=Beach")
        names = [c["name"] for c in res.json()]
        assert "Beach Cleanup" in names
        assert "Park Rangers" not in names


class TestGetCommunity:
    def test_get_active(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.get(f"/api/communities/{c.id}")
        assert res.status_code == 200
        assert res.json()["name"] == c.name

    def test_get_under_review_anon(self, client, db, volunteer):
        c = _create_community(db, volunteer, status=CommunityStatus.under_review)
        res = client.get(f"/api/communities/{c.id}")
        assert res.status_code == 404

    def test_get_under_review_owner(self, client, db, volunteer):
        c = _create_community(db, volunteer, status=CommunityStatus.under_review)
        res = client.get(f"/api/communities/{c.id}", headers=auth_header(volunteer))
        assert res.status_code == 200

    def test_get_under_review_moderator(self, client, db, volunteer, moderator):
        c = _create_community(db, volunteer, status=CommunityStatus.under_review)
        res = client.get(f"/api/communities/{c.id}", headers=auth_header(moderator))
        assert res.status_code == 200

    def test_get_nonexistent(self, client, db):
        res = client.get("/api/communities/9999")
        assert res.status_code == 404


class TestDeleteCommunity:
    def test_admin_can_delete(self, client, db, volunteer, admin):
        c = _create_community(db, volunteer)
        res = client.delete(f"/api/communities/{c.id}", headers=auth_header(admin))
        assert res.status_code == 204

    def test_volunteer_cannot_delete(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.delete(f"/api/communities/{c.id}", headers=auth_header(volunteer))
        assert res.status_code == 403

    def test_delete_nonexistent(self, client, db, admin):
        res = client.delete("/api/communities/9999", headers=auth_header(admin))
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# Moderation
# ---------------------------------------------------------------------------


class TestModeration:
    def test_moderator_blocks_community(self, client, db, volunteer, moderator):
        c = _create_community(db, volunteer)
        res = client.patch(
            f"/api/communities/{c.id}/status",
            json={"status": "under_review"},
            headers=auth_header(moderator),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "under_review"

    def test_moderator_unlocks_community(self, client, db, volunteer, moderator):
        c = _create_community(db, volunteer, status=CommunityStatus.under_review)
        res = client.patch(
            f"/api/communities/{c.id}/status",
            json={"status": "active"},
            headers=auth_header(moderator),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "active"

    def test_volunteer_cannot_change_status(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.patch(
            f"/api/communities/{c.id}/status",
            json={"status": "under_review"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------


class TestPosts:
    def test_owner_creates_post(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.post(
            f"/api/communities/{c.id}/posts",
            json={"content": "Hello world!"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 201
        assert res.json()["content"] == "Hello world!"

    def test_non_owner_cannot_create_post(self, client, db, volunteer):
        other = _make_user(db, email="other@example.com")
        c = _create_community(db, volunteer)
        res = client.post(
            f"/api/communities/{c.id}/posts",
            json={"content": "Intruder!"},
            headers=auth_header(other),
        )
        assert res.status_code == 403

    def test_owner_edits_post(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        post = CommunityPost(community_id=c.id, content="Original")
        db.add(post)
        db.commit()
        db.refresh(post)

        res = client.patch(
            f"/api/communities/{c.id}/posts/{post.id}",
            json={"content": "Updated"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["content"] == "Updated"

    def test_non_owner_cannot_edit_post(self, client, db, volunteer):
        other = _make_user(db, email="other2@example.com")
        c = _create_community(db, volunteer)
        post = CommunityPost(community_id=c.id, content="Original")
        db.add(post)
        db.commit()
        db.refresh(post)

        res = client.patch(
            f"/api/communities/{c.id}/posts/{post.id}",
            json={"content": "Hacked"},
            headers=auth_header(other),
        )
        assert res.status_code == 403

    def test_owner_deletes_post(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        post = CommunityPost(community_id=c.id, content="Bye")
        db.add(post)
        db.commit()
        db.refresh(post)

        res = client.delete(
            f"/api/communities/{c.id}/posts/{post.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 204


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class TestEvents:
    def test_owner_creates_event(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        report = _create_report(db)
        res = client.post(
            f"/api/communities/{c.id}/events",
            json={
                "description": "Saturday cleanup",
                "date": "2026-04-01T10:00:00",
                "meeting_latitude": UK_LAT,
                "meeting_longitude": UK_LON,
                "report_ids": [report.id],
            },
            headers=auth_header(volunteer),
        )
        assert res.status_code == 201
        data = res.json()
        assert data["description"] == "Saturday cleanup"
        assert data["report_ids"] == [report.id]
        assert data["meeting_latitude"] == UK_LAT

    def test_event_has_correct_fields(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        r1 = _create_report(db, description="spot 1")
        r2 = _create_report(db, description="spot 2")
        res = client.post(
            f"/api/communities/{c.id}/events",
            json={
                "description": "Big cleanup",
                "date": "2026-04-05T09:00:00",
                "meeting_latitude": 51.6,
                "meeting_longitude": -0.2,
                "report_ids": [r1.id, r2.id],
            },
            headers=auth_header(volunteer),
        )
        data = res.json()
        assert set(data["report_ids"]) == {r1.id, r2.id}
        assert data["meeting_latitude"] == 51.6
        assert data["meeting_longitude"] == -0.2

    def test_owner_edits_event(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        create_res = client.post(
            f"/api/communities/{c.id}/events",
            json={
                "description": "Original",
                "date": "2026-04-01T10:00:00",
                "meeting_latitude": UK_LAT,
                "meeting_longitude": UK_LON,
            },
            headers=auth_header(volunteer),
        )
        event_id = create_res.json()["id"]

        res = client.patch(
            f"/api/communities/{c.id}/events/{event_id}",
            json={"description": "Updated", "meeting_latitude": 52.0},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["description"] == "Updated"
        assert res.json()["meeting_latitude"] == 52.0

    def test_non_owner_cannot_create_event(self, client, db, volunteer):
        other = _make_user(db, email="other3@example.com")
        c = _create_community(db, volunteer)
        res = client.post(
            f"/api/communities/{c.id}/events",
            json={
                "description": "Intruder event",
                "date": "2026-04-01T10:00:00",
                "meeting_latitude": UK_LAT,
                "meeting_longitude": UK_LON,
            },
            headers=auth_header(other),
        )
        assert res.status_code == 403

    def test_non_owner_cannot_edit_event(self, client, db, volunteer):
        other = _make_user(db, email="other4@example.com")
        c = _create_community(db, volunteer)
        create_res = client.post(
            f"/api/communities/{c.id}/events",
            json={
                "description": "Owned event",
                "date": "2026-04-01T10:00:00",
                "meeting_latitude": UK_LAT,
                "meeting_longitude": UK_LON,
            },
            headers=auth_header(volunteer),
        )
        event_id = create_res.json()["id"]

        res = client.patch(
            f"/api/communities/{c.id}/events/{event_id}",
            json={"description": "Hacked"},
            headers=auth_header(other),
        )
        assert res.status_code == 403

    def test_owner_deletes_event(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        create_res = client.post(
            f"/api/communities/{c.id}/events",
            json={
                "description": "Doomed event",
                "date": "2026-04-01T10:00:00",
                "meeting_latitude": UK_LAT,
                "meeting_longitude": UK_LON,
            },
            headers=auth_header(volunteer),
        )
        event_id = create_res.json()["id"]

        res = client.delete(
            f"/api/communities/{c.id}/events/{event_id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 204


# ---------------------------------------------------------------------------
# Profile image
# ---------------------------------------------------------------------------


class TestProfileImage:
    def test_owner_uploads_image(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        buf = _make_upload_image()

        with patch("app.routers.communities.IMAGES_DIR", "/tmp"):
            res = client.put(
                f"/api/communities/{c.id}/image",
                files={"file": ("photo.jpg", buf, "image/jpeg")},
                headers=auth_header(volunteer),
            )
        assert res.status_code == 200
        assert res.json()["profile_image"] is not None

    def test_non_owner_cannot_upload(self, client, db, volunteer):
        other = _make_user(db, email="other5@example.com")
        c = _create_community(db, volunteer)
        buf = _make_upload_image()

        res = client.put(
            f"/api/communities/{c.id}/image",
            files={"file": ("photo.jpg", buf, "image/jpeg")},
            headers=auth_header(other),
        )
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------


class TestJoinCommunity:
    def test_join_success(self, client, db, volunteer):
        other = _make_user(db, email="joiner@example.com")
        c = _create_community(db, volunteer)
        res = client.post(
            f"/api/communities/{c.id}/join",
            headers=auth_header(other),
        )
        assert res.status_code == 201
        assert res.json()["status"] == "pending"
        assert res.json()["user_id"] == other.id

    def test_join_duplicate(self, client, db, volunteer):
        other = _make_user(db, email="dup_joiner@example.com")
        c = _create_community(db, volunteer)
        client.post(f"/api/communities/{c.id}/join", headers=auth_header(other))
        res = client.post(f"/api/communities/{c.id}/join", headers=auth_header(other))
        assert res.status_code == 409

    def test_owner_cannot_join_own(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.post(f"/api/communities/{c.id}/join", headers=auth_header(volunteer))
        assert res.status_code == 409

    def test_join_unauthenticated(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.post(f"/api/communities/{c.id}/join")
        assert res.status_code == 401


class TestApproveMembership:
    def test_owner_approves(self, client, db, volunteer):
        other = _make_user(db, email="approve_me@example.com")
        c = _create_community(db, volunteer)
        join_res = client.post(f"/api/communities/{c.id}/join", headers=auth_header(other))
        mid = join_res.json()["id"]

        res = client.patch(
            f"/api/communities/{c.id}/memberships/{mid}",
            json={"status": "approved"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "approved"

    def test_owner_rejects(self, client, db, volunteer):
        other = _make_user(db, email="reject_me@example.com")
        c = _create_community(db, volunteer)
        join_res = client.post(f"/api/communities/{c.id}/join", headers=auth_header(other))
        mid = join_res.json()["id"]

        res = client.patch(
            f"/api/communities/{c.id}/memberships/{mid}",
            json={"status": "rejected"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "rejected"

    def test_non_owner_cannot_approve(self, client, db, volunteer):
        other = _make_user(db, email="sneaky@example.com")
        joiner = _make_user(db, email="joiner2@example.com")
        c = _create_community(db, volunteer)
        join_res = client.post(f"/api/communities/{c.id}/join", headers=auth_header(joiner))
        mid = join_res.json()["id"]

        res = client.patch(
            f"/api/communities/{c.id}/memberships/{mid}",
            json={"status": "approved"},
            headers=auth_header(other),
        )
        assert res.status_code == 403


class TestLeaveCommunity:
    def test_member_leaves(self, client, db, volunteer):
        other = _make_user(db, email="leaver@example.com")
        c = _create_community(db, volunteer)
        client.post(f"/api/communities/{c.id}/join", headers=auth_header(other))
        # Approve first
        mem = db.query(CommunityMembership).filter(CommunityMembership.user_id == other.id).first()
        mem.status = MembershipStatus.approved
        db.commit()

        res = client.delete(f"/api/communities/{c.id}/leave", headers=auth_header(other))
        assert res.status_code == 204

    def test_owner_cannot_leave(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        res = client.delete(f"/api/communities/{c.id}/leave", headers=auth_header(volunteer))
        assert res.status_code == 403


class TestListMemberships:
    def test_owner_sees_all(self, client, db, volunteer):
        other = _make_user(db, email="pending_user@example.com")
        c = _create_community(db, volunteer)
        client.post(f"/api/communities/{c.id}/join", headers=auth_header(other))

        res = client.get(
            f"/api/communities/{c.id}/memberships",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["status"] == "pending"

    def test_non_owner_sees_only_approved(self, client, db, volunteer):
        joiner = _make_user(db, email="approved_user@example.com")
        pending = _make_user(db, email="pending_user2@example.com")
        c = _create_community(db, volunteer)

        # Add approved member
        db.add(
            CommunityMembership(
                community_id=c.id, user_id=joiner.id, status=MembershipStatus.approved
            )
        )
        # Add pending member
        db.add(
            CommunityMembership(
                community_id=c.id, user_id=pending.id, status=MembershipStatus.pending
            )
        )
        db.commit()

        res = client.get(
            f"/api/communities/{c.id}/memberships",
            headers=auth_header(joiner),
        )
        assert res.status_code == 200
        statuses = [m["status"] for m in res.json()]
        assert "approved" in statuses
        assert "pending" not in statuses


# ---------------------------------------------------------------------------
# Content visibility (posts/events hidden for non-members)
# ---------------------------------------------------------------------------


class TestContentVisibility:
    def test_non_member_cannot_see_posts(self, client, db, volunteer):
        """Non-member sees community info but posts/events are empty."""
        other = _make_user(db, email="outsider@example.com")
        c = _create_community(db, volunteer)
        db.add(CommunityPost(community_id=c.id, content="Secret post"))
        db.commit()

        res = client.get(f"/api/communities/{c.id}", headers=auth_header(other))
        assert res.status_code == 200
        assert res.json()["posts"] == []

    def test_anon_cannot_see_posts(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        db.add(CommunityPost(community_id=c.id, content="Secret post"))
        db.commit()

        res = client.get(f"/api/communities/{c.id}")
        assert res.status_code == 200
        assert res.json()["posts"] == []

    def test_owner_sees_posts(self, client, db, volunteer):
        c = _create_community(db, volunteer)
        db.add(CommunityPost(community_id=c.id, content="Owner post"))
        db.commit()

        res = client.get(f"/api/communities/{c.id}", headers=auth_header(volunteer))
        assert res.status_code == 200
        assert len(res.json()["posts"]) == 1

    def test_approved_member_sees_posts(self, client, db, volunteer):
        member = _make_user(db, email="member@example.com")
        c = _create_community(db, volunteer)
        db.add(CommunityPost(community_id=c.id, content="Member visible"))
        db.add(
            CommunityMembership(
                community_id=c.id, user_id=member.id, status=MembershipStatus.approved
            )
        )
        db.commit()

        res = client.get(f"/api/communities/{c.id}", headers=auth_header(member))
        assert res.status_code == 200
        assert len(res.json()["posts"]) == 1

    def test_pending_member_cannot_see_posts(self, client, db, volunteer):
        pending = _make_user(db, email="pending_member@example.com")
        c = _create_community(db, volunteer)
        db.add(CommunityPost(community_id=c.id, content="Hidden"))
        db.add(
            CommunityMembership(
                community_id=c.id, user_id=pending.id, status=MembershipStatus.pending
            )
        )
        db.commit()

        res = client.get(f"/api/communities/{c.id}", headers=auth_header(pending))
        assert res.status_code == 200
        assert res.json()["posts"] == []

    def test_moderator_sees_posts(self, client, db, volunteer, moderator):
        c = _create_community(db, volunteer)
        db.add(CommunityPost(community_id=c.id, content="Mod visible"))
        db.commit()

        res = client.get(f"/api/communities/{c.id}", headers=auth_header(moderator))
        assert res.status_code == 200
        assert len(res.json()["posts"]) == 1


# ---------------------------------------------------------------------------
# My communities
# ---------------------------------------------------------------------------


class TestMyCommunities:
    def test_returns_owned_and_joined(self, client, db, volunteer):
        other_owner = _make_user(db, email="owner2@example.com")
        owned = _create_community(db, volunteer, name="My Community")
        joined_c = _create_community(db, other_owner, name="Other Community")
        db.add(
            CommunityMembership(
                community_id=joined_c.id, user_id=volunteer.id, status=MembershipStatus.approved
            )
        )
        db.commit()

        res = client.get("/api/communities/mine", headers=auth_header(volunteer))
        assert res.status_code == 200
        data = res.json()
        owned_names = [c["name"] for c in data["owned"]]
        joined_names = [c["name"] for c in data["joined"]]
        assert "My Community" in owned_names
        assert "Other Community" in joined_names

    def test_pending_not_in_joined(self, client, db, volunteer):
        other_owner = _make_user(db, email="owner3@example.com")
        c = _create_community(db, other_owner, name="Pending Community")
        db.add(
            CommunityMembership(
                community_id=c.id, user_id=volunteer.id, status=MembershipStatus.pending
            )
        )
        db.commit()

        res = client.get("/api/communities/mine", headers=auth_header(volunteer))
        joined_names = [c["name"] for c in res.json()["joined"]]
        assert "Pending Community" not in joined_names

    def test_unauthenticated(self, client, db):
        res = client.get("/api/communities/mine")
        assert res.status_code == 401
