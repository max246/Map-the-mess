"""Community routes — create, moderate, post updates, and plan events."""

import os
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from PIL import Image
from sqlalchemy.orm import Session
from typing import Optional

from app.config import IMAGES_DIR, SECRET_KEY
from app.database import get_db
from app.models.community import Community, CommunityStatus
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.community_post import CommunityPost
from app.models.community_event import CommunityEvent, event_reports
from app.models.report import Report
from app.models.user import User, UserType
from app.routers.auth import (
    ALGORITHM,
    get_current_user,
    require_admin,
    require_moderator_or_admin,
)
from app.schemas.community import (
    CommunityCreate,
    CommunityDetail,
    CommunityRead,
    CommunityStatusUpdate,
    EventCreate,
    EventRead,
    EventUpdate,
    MembershipAction,
    MembershipRead,
    MyCommunities,
    RejectedCommunity,
    PostCreate,
    PostRead,
    PostUpdate,
)
from jose import JWTError, jwt

router = APIRouter()

PROFILE_IMAGE_SIZE = (300, 300)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def _is_moderator_or_above(user: User | None) -> bool:
    if user is None:
        return False
    return user.user_type in (UserType.superuser, UserType.admin, UserType.moderator)


def _get_community_or_404(community_id: int, db: Session) -> Community:
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


def _require_owner(community: Community, user: User) -> None:
    if community.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the community owner can do this")


def _is_member_or_owner(community: Community, user: User | None, db: Session) -> bool:
    """Return True if the user is the owner or an approved member."""
    if user is None:
        return False
    if community.owner_id == user.id:
        return True
    membership = (
        db.query(CommunityMembership)
        .filter(
            CommunityMembership.community_id == community.id,
            CommunityMembership.user_id == user.id,
            CommunityMembership.status == MembershipStatus.approved,
        )
        .first()
    )
    return membership is not None


def _require_content_access(community: Community, user: User | None, db: Session) -> None:
    """Raise 403 if the user is not an approved member, owner, or moderator+."""
    if _is_moderator_or_above(user):
        return
    if not _is_member_or_owner(community, user, db):
        raise HTTPException(status_code=403, detail="You must be a member to view this content")


def _save_profile_image(file: UploadFile) -> str:
    """Save an uploaded file as a 300x300 JPEG. Returns the filename."""
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

    img.thumbnail(PROFILE_IMAGE_SIZE, Image.Resampling.LANCZOS)
    filename = f"community_{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(IMAGES_DIR, filename), format="JPEG", quality=85, optimize=True)
    return filename


def _event_to_read(event: CommunityEvent) -> EventRead:
    """Convert a CommunityEvent ORM object to an EventRead schema."""
    return EventRead(
        id=event.id,
        community_id=event.community_id,
        description=event.description,
        date=event.date,
        meeting_latitude=event.meeting_latitude,
        meeting_longitude=event.meeting_longitude,
        report_ids=[r.id for r in event.reports],
        created_at=event.created_at,
    )


def _community_to_detail(community: Community, show_content: bool = True) -> CommunityDetail:
    """Convert a Community ORM object to a CommunityDetail schema.

    If show_content is False, posts and events are hidden (empty lists).
    """
    return CommunityDetail(
        id=community.id,
        name=community.name,
        description=community.description,
        facebook_url=community.facebook_url,
        profile_image=community.profile_image,
        latitude=community.latitude,
        longitude=community.longitude,
        radius_km=community.radius_km,
        owner_id=community.owner_id,
        status=(
            community.status.value
            if isinstance(community.status, CommunityStatus)
            else community.status
        ),
        created_at=community.created_at,
        posts=[PostRead.model_validate(p) for p in community.posts] if show_content else [],
        events=[_event_to_read(e) for e in community.events] if show_content else [],
    )


# ---------------------------------------------------------------------------
# Community CRUD
# ---------------------------------------------------------------------------


@router.post("/", response_model=CommunityRead, status_code=201)
def create_community(
    payload: CommunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new community. The current user becomes the owner."""
    existing = db.query(Community).filter(Community.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="A community with this name already exists")

    community = Community(
        name=payload.name,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_km=payload.radius_km,
        facebook_url=payload.facebook_url,
        owner_id=current_user.id,
    )
    db.add(community)
    db.commit()
    db.refresh(community)
    return community


@router.get("/", response_model=list[CommunityRead])
def list_communities(
    search: Optional[str] = Query(None, description="Search by community name"),
    lat: Optional[float] = Query(None, description="Latitude for nearby search"),
    lng: Optional[float] = Query(None, description="Longitude for nearby search"),
    radius_km: Optional[float] = Query(None, description="Radius in km for nearby search"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_user),
):
    """List communities with optional search and location filters.

    Visibility: anon/volunteer see active only. Owner also sees own under_review.
    Moderator+ sees all.
    """
    q = db.query(Community)

    if search:
        q = q.filter(Community.name.ilike(f"%{search}%"))

    if lat is not None and lng is not None and radius_km is not None:
        # Simple bounding-box approximation (~111 km per degree)
        delta_lat = radius_km / 111.0
        delta_lng = radius_km / 111.0
        q = q.filter(
            Community.latitude.between(lat - delta_lat, lat + delta_lat),
            Community.longitude.between(lng - delta_lng, lng + delta_lng),
        )

    communities = q.order_by(Community.created_at.desc()).all()

    # Apply visibility filtering
    if _is_moderator_or_above(current_user):
        return communities

    visible = []
    for c in communities:
        if c.status == CommunityStatus.active:
            visible.append(c)
        elif current_user and c.owner_id == current_user.id:
            visible.append(c)
    return visible


@router.get("/mine", response_model=MyCommunities)
def my_communities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's owned and joined (approved) communities."""
    owned = (
        db.query(Community)
        .filter(Community.owner_id == current_user.id)
        .order_by(Community.created_at.desc())
        .all()
    )

    joined_communities = (
        db.query(Community)
        .join(CommunityMembership, CommunityMembership.community_id == Community.id)
        .filter(
            CommunityMembership.user_id == current_user.id,
            CommunityMembership.status == MembershipStatus.approved,
        )
        .order_by(Community.created_at.desc())
        .all()
    )

    pending_communities = (
        db.query(Community)
        .join(CommunityMembership, CommunityMembership.community_id == Community.id)
        .filter(
            CommunityMembership.user_id == current_user.id,
            CommunityMembership.status == MembershipStatus.pending,
        )
        .order_by(Community.created_at.desc())
        .all()
    )

    rejected_memberships = (
        db.query(CommunityMembership)
        .filter(
            CommunityMembership.user_id == current_user.id,
            CommunityMembership.status == MembershipStatus.rejected,
        )
        .all()
    )
    rejected_community_ids = [m.community_id for m in rejected_memberships]
    rejected_communities = (
        db.query(Community).filter(Community.id.in_(rejected_community_ids)).all()
        if rejected_community_ids
        else []
    )
    rejected_map = {m.community_id: m for m in rejected_memberships}

    return MyCommunities(
        owned=[CommunityRead.model_validate(c) for c in owned],
        joined=[CommunityRead.model_validate(c) for c in joined_communities],
        pending=[CommunityRead.model_validate(c) for c in pending_communities],
        rejected=[
            RejectedCommunity(
                community=CommunityRead.model_validate(c),
                rejected_at=rejected_map[c.id].updated_at or rejected_map[c.id].created_at,
            )
            for c in rejected_communities
        ],
    )


@router.get("/{community_id}", response_model=CommunityDetail)
def get_community(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_user),
):
    """Get a single community. Posts and events are only visible to members, owner, or moderator+."""
    community = _get_community_or_404(community_id, db)

    # Visibility check for under_review communities
    if community.status != CommunityStatus.active:
        if not _is_moderator_or_above(current_user):
            if not current_user or community.owner_id != current_user.id:
                raise HTTPException(status_code=404, detail="Community not found")

    # Posts/events visible only to owner, approved members, or moderator+
    show_content = _is_moderator_or_above(current_user) or _is_member_or_owner(
        community, current_user, db
    )

    return _community_to_detail(community, show_content=show_content)


@router.delete("/{community_id}", status_code=204)
def delete_community(
    community_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Delete a community. Admin/superuser only."""
    community = _get_community_or_404(community_id, db)
    db.delete(community)
    db.commit()


# ---------------------------------------------------------------------------
# Profile image
# ---------------------------------------------------------------------------


@router.put("/{community_id}/image", response_model=CommunityRead)
def upload_profile_image(
    community_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload or replace the community profile image. Owner only."""
    community = _get_community_or_404(community_id, db)
    _require_owner(community, current_user)

    # Delete old image if it exists
    if community.profile_image:
        old_path = os.path.join(IMAGES_DIR, community.profile_image)
        if os.path.isfile(old_path):
            os.remove(old_path)

    community.profile_image = _save_profile_image(file)
    db.commit()
    db.refresh(community)
    return community


# ---------------------------------------------------------------------------
# Moderation
# ---------------------------------------------------------------------------


@router.patch("/{community_id}/status", response_model=CommunityRead)
def update_community_status(
    community_id: int,
    payload: CommunityStatusUpdate,
    db: Session = Depends(get_db),
    _mod: User = Depends(require_moderator_or_admin),
):
    """Set community status to active or under_review. Moderator+ only."""
    community = _get_community_or_404(community_id, db)

    try:
        new_status = CommunityStatus(payload.status)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(s.value for s in CommunityStatus)}",
        )

    community.status = new_status
    db.commit()
    db.refresh(community)
    return community


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------


@router.post("/{community_id}/posts", response_model=PostRead, status_code=201)
def create_post(
    community_id: int,
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a post on a community page. Owner only."""
    community = _get_community_or_404(community_id, db)
    _require_owner(community, current_user)

    post = CommunityPost(community_id=community.id, content=payload.content)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/{community_id}/posts/{post_id}", response_model=PostRead)
def update_post(
    community_id: int,
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a post. Owner only."""
    community = _get_community_or_404(community_id, db)
    _require_owner(community, current_user)

    post = (
        db.query(CommunityPost)
        .filter(CommunityPost.id == post_id, CommunityPost.community_id == community.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.content = payload.content
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{community_id}/posts/{post_id}", status_code=204)
def delete_post(
    community_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a post. Owner or moderator+ only."""
    community = _get_community_or_404(community_id, db)

    if community.owner_id != current_user.id and not _is_moderator_or_above(current_user):
        raise HTTPException(
            status_code=403, detail="Only the community owner or a moderator can do this"
        )

    post = (
        db.query(CommunityPost)
        .filter(CommunityPost.id == post_id, CommunityPost.community_id == community.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    db.delete(post)
    db.commit()


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


def _attach_reports(event: CommunityEvent, report_ids: list[int], db: Session) -> None:
    """Replace the event's linked reports with the given IDs."""
    reports = db.query(Report).filter(Report.id.in_(report_ids)).all() if report_ids else []
    if len(reports) != len(report_ids):
        found = {r.id for r in reports}
        missing = set(report_ids) - found
        raise HTTPException(status_code=404, detail=f"Reports not found: {missing}")
    event.reports = reports


@router.post("/{community_id}/events", response_model=EventRead, status_code=201)
def create_event(
    community_id: int,
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a cleanup event. Owner only."""
    community = _get_community_or_404(community_id, db)
    _require_owner(community, current_user)

    event = CommunityEvent(
        community_id=community.id,
        description=payload.description,
        date=payload.date,
        meeting_latitude=payload.meeting_latitude,
        meeting_longitude=payload.meeting_longitude,
    )
    db.add(event)
    db.flush()  # get event.id before attaching reports

    _attach_reports(event, payload.report_ids, db)
    db.commit()
    db.refresh(event)
    return _event_to_read(event)


@router.get("/{community_id}/events/{event_id}", response_model=EventRead)
def get_event(
    community_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_user),
):
    """Get a single event. Only members, owner, or moderator+ can view."""
    community = _get_community_or_404(community_id, db)
    _require_content_access(community, current_user, db)

    event = (
        db.query(CommunityEvent)
        .filter(CommunityEvent.id == event_id, CommunityEvent.community_id == community.id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return _event_to_read(event)


@router.patch("/{community_id}/events/{event_id}", response_model=EventRead)
def update_event(
    community_id: int,
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit an event. Owner only. All fields optional for partial update."""
    community = _get_community_or_404(community_id, db)
    _require_owner(community, current_user)

    event = (
        db.query(CommunityEvent)
        .filter(CommunityEvent.id == event_id, CommunityEvent.community_id == community.id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if payload.description is not None:
        event.description = payload.description
    if payload.date is not None:
        event.date = payload.date
    if payload.meeting_latitude is not None:
        event.meeting_latitude = payload.meeting_latitude
    if payload.meeting_longitude is not None:
        event.meeting_longitude = payload.meeting_longitude
    if payload.report_ids is not None:
        _attach_reports(event, payload.report_ids, db)

    db.commit()
    db.refresh(event)
    return _event_to_read(event)


@router.delete("/{community_id}/events/{event_id}", status_code=204)
def delete_event(
    community_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an event. Owner or moderator+ only."""
    community = _get_community_or_404(community_id, db)

    if community.owner_id != current_user.id and not _is_moderator_or_above(current_user):
        raise HTTPException(
            status_code=403, detail="Only the community owner or a moderator can do this"
        )

    event = (
        db.query(CommunityEvent)
        .filter(CommunityEvent.id == event_id, CommunityEvent.community_id == community.id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------


@router.post("/{community_id}/join", response_model=MembershipRead, status_code=201)
def join_community(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request to join a community. Status starts as pending until owner approves."""
    community = _get_community_or_404(community_id, db)

    if community.owner_id == current_user.id:
        raise HTTPException(status_code=409, detail="You are the owner of this community")

    existing = (
        db.query(CommunityMembership)
        .filter(
            CommunityMembership.community_id == community.id,
            CommunityMembership.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        if existing.status == MembershipStatus.rejected:
            # Allow re-joining after 24h cooldown
            rejected_at = existing.updated_at or existing.created_at
            if rejected_at:
                cooldown = rejected_at.replace(tzinfo=timezone.utc) + timedelta(hours=24)
                if datetime.now(timezone.utc) < cooldown:
                    raise HTTPException(
                        status_code=429,
                        detail="You can request to join again after 24 hours",
                    )
            # Cooldown passed — reset to pending
            existing.status = MembershipStatus.pending
            existing.created_at = datetime.now(timezone.utc)
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(
            status_code=409, detail="You have already requested to join this community"
        )

    membership = CommunityMembership(
        community_id=community.id,
        user_id=current_user.id,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


@router.get("/{community_id}/memberships", response_model=list[MembershipRead])
def list_memberships(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List memberships. Only the community owner, admin, or superuser can access."""
    community = _get_community_or_404(community_id, db)

    is_owner = community.owner_id == current_user.id
    is_admin = current_user.user_type in (UserType.superuser, UserType.admin)
    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403, detail="Only the community owner or an admin can view memberships"
        )

    q = db.query(CommunityMembership).filter(CommunityMembership.community_id == community.id)

    memberships = q.order_by(CommunityMembership.created_at.desc()).all()

    # Enrich with user names
    user_ids = [m.user_id for m in memberships]
    users = (
        {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )

    return [
        MembershipRead(
            id=m.id,
            community_id=m.community_id,
            user_id=m.user_id,
            user_name=users.get(m.user_id, ""),
            status=m.status.value if hasattr(m.status, "value") else m.status,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in memberships
    ]


@router.patch(
    "/{community_id}/memberships/{membership_id}",
    response_model=MembershipRead,
)
def update_membership(
    community_id: int,
    membership_id: int,
    payload: MembershipAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve or reject a membership request. Owner only."""
    community = _get_community_or_404(community_id, db)
    _require_owner(community, current_user)

    membership = (
        db.query(CommunityMembership)
        .filter(
            CommunityMembership.id == membership_id,
            CommunityMembership.community_id == community.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    try:
        new_status = MembershipStatus(payload.status)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(s.value for s in MembershipStatus)}",
        )

    membership.status = new_status
    membership.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(membership)
    return membership


@router.delete("/{community_id}/leave", status_code=204)
def leave_community(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a community. Owner cannot leave — they must delete the community."""
    community = _get_community_or_404(community_id, db)

    if community.owner_id == current_user.id:
        raise HTTPException(
            status_code=403, detail="Owner cannot leave. Delete the community instead."
        )

    membership = (
        db.query(CommunityMembership)
        .filter(
            CommunityMembership.community_id == community.id,
            CommunityMembership.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    db.delete(membership)
    db.commit()
