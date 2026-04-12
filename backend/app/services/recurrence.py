"""Recurrence expansion for community events.

Virtual occurrences are computed on the fly from a parent event's recurrence rule.
A real DB row (exception) is only created when an occurrence diverges — e.g. someone
attends, the occurrence is cancelled, or its details are edited.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta, weekday as rd_weekday

from app.models.community_event import CommunityEvent

# How far ahead to expand when no explicit range_end is given.
DEFAULT_HORIZON_WEEKS = 12

# Map weekday index (0=Monday) to dateutil weekday constructors.
_WEEKDAY_MAP = {
    0: rd_weekday(0),  # MO
    1: rd_weekday(1),  # TU
    2: rd_weekday(2),  # WE
    3: rd_weekday(3),  # TH
    4: rd_weekday(4),  # FR
    5: rd_weekday(5),  # SA
    6: rd_weekday(6),  # SU
}


def _nth_weekday(dt: datetime) -> tuple[int, int]:
    """Return (weekday_index, nth) for a date.  e.g. 2nd Saturday -> (5, 2)."""
    return dt.weekday(), (dt.day - 1) // 7 + 1


def expand_occurrences(
    parent: CommunityEvent,
    range_start: datetime,
    range_end: datetime,
) -> list[datetime]:
    """Compute occurrence datetimes for *parent* within [range_start, range_end].

    The parent's ``date`` is the anchor (first occurrence).  Only dates on or
    after ``parent.date`` are generated.  ``parent.recurrence_end`` is honoured
    if set.
    """
    rule = parent.recurrence_rule
    if not rule:
        # One-off event — return the single date if it falls in range.
        if range_start <= parent.date <= range_end:  # type: ignore[operator]
            return [parent.date]  # type: ignore[list-item]
        return []

    end = min(range_end, parent.recurrence_end) if parent.recurrence_end else range_end  # type: ignore[type-var]
    anchor: datetime = parent.date  # type: ignore[assignment]
    dates: list[datetime] = []

    if rule == "weekly":
        step = timedelta(weeks=1)
        current = anchor
        while current <= end:  # type: ignore[operator]
            if current >= range_start:
                dates.append(current)
            current += step

    elif rule == "biweekly":
        step = timedelta(weeks=2)
        current = anchor
        while current <= end:  # type: ignore[operator]
            if current >= range_start:
                dates.append(current)
            current += step

    elif rule == "monthly":
        wd_index, nth = _nth_weekday(anchor)
        wd = _WEEKDAY_MAP[wd_index]
        current = anchor
        while current <= end:  # type: ignore[operator]
            if current >= range_start:
                dates.append(current)
            # Jump one month and find the Nth weekday.
            next_month = current + relativedelta(months=1)
            # Reset to 1st of that month, then jump to Nth weekday.
            first = next_month.replace(day=1)
            candidate = first + relativedelta(weekday=wd(nth))
            # Preserve the original time of day.
            current = candidate.replace(
                hour=anchor.hour,
                minute=anchor.minute,
                second=anchor.second,
                microsecond=anchor.microsecond,
            )
    else:
        # Unknown rule — treat as one-off.
        if range_start <= parent.date <= range_end:  # type: ignore[operator]
            return [parent.date]  # type: ignore[list-item]
        return []

    return dates


# ---------------------------------------------------------------------------
# Composite occurrence identifiers
# ---------------------------------------------------------------------------

_SEP = ":"


def build_occurrence_id(parent_id: uuid.UUID, occurrence_date: datetime) -> str:
    """Stable composite key: ``'{parent_uuid}:{iso_date}'``."""
    return f"{parent_id}{_SEP}{occurrence_date.isoformat()}"


def parse_occurrence_id(occurrence_id: str) -> tuple[uuid.UUID, datetime]:
    """Inverse of :func:`build_occurrence_id`.

    Returns ``(parent_uuid, occurrence_datetime)``.
    Raises ``ValueError`` if *occurrence_id* is a plain UUID (not composite).
    """
    if _SEP not in occurrence_id:
        raise ValueError("Not a composite occurrence ID")
    parent_str, date_str = occurrence_id.split(_SEP, 1)
    return uuid.UUID(parent_str), datetime.fromisoformat(date_str)


def is_composite_id(occurrence_id: str) -> bool:
    """Check whether *occurrence_id* is a composite (virtual) ID."""
    try:
        parse_occurrence_id(occurrence_id)
        return True
    except (ValueError, IndexError):
        return False


# ---------------------------------------------------------------------------
# Merging virtual occurrences with materialised exceptions
# ---------------------------------------------------------------------------


def merge_with_exceptions(
    parent: CommunityEvent,
    occurrence_dates: list[datetime],
    exceptions: list[CommunityEvent],
    current_user_id: uuid.UUID | None = None,
    attendee_counts: dict[uuid.UUID, int] | None = None,
    user_attending_ids: set[uuid.UUID] | None = None,
) -> list[dict]:
    """Build a list of dicts (ready for ``EventOccurrenceRead``) by overlaying
    materialised exception rows onto virtual occurrences.

    Parameters
    ----------
    parent : CommunityEvent
        The recurring series parent.
    occurrence_dates : list[datetime]
        Dates produced by :func:`expand_occurrences`.
    exceptions : list[CommunityEvent]
        Materialised exception rows (children of *parent*).
    current_user_id : uuid.UUID | None
        The requesting user's ID, used to set ``is_attending``.
    attendee_counts : dict[uuid.UUID, int] | None
        Pre-fetched ``{event_id: count}`` for exception rows.
    user_attending_ids : set[uuid.UUID] | None
        Set of exception event IDs the current user is attending.
    """
    exc_by_date: dict[datetime, CommunityEvent] = {e.date: e for e in exceptions}  # type: ignore[misc]
    attendee_counts = attendee_counts or {}
    user_attending_ids = user_attending_ids or set()
    results: list[dict] = []

    for dt in occurrence_dates:
        exc = exc_by_date.get(dt)
        if exc:
            results.append(
                {
                    "occurrence_id": str(exc.id),
                    "event_id": parent.id,
                    "community_id": parent.community_id,
                    "title": exc.title,
                    "description": exc.description,
                    "date": exc.date,
                    "meeting_latitude": exc.meeting_latitude,
                    "meeting_longitude": exc.meeting_longitude,
                    "report_ids": [r.id for r in exc.reports],
                    "attendee_count": attendee_counts.get(exc.id, 0),  # type: ignore[call-overload]
                    "is_attending": exc.id in user_attending_ids,
                    "is_recurring": True,
                    "is_cancelled": exc.is_cancelled,
                    "recurrence_rule": parent.recurrence_rule,
                    "recurrence_end": parent.recurrence_end,
                    "is_exception": True,
                    "created_at": exc.created_at,
                }
            )
        else:
            results.append(
                {
                    "occurrence_id": build_occurrence_id(parent.id, dt),  # type: ignore[arg-type]
                    "event_id": parent.id,
                    "community_id": parent.community_id,
                    "title": parent.title,
                    "description": parent.description,
                    "date": dt,
                    "meeting_latitude": parent.meeting_latitude,
                    "meeting_longitude": parent.meeting_longitude,
                    "report_ids": [r.id for r in parent.reports],
                    "attendee_count": 0,
                    "is_attending": False,
                    "is_recurring": True,
                    "is_cancelled": False,
                    "recurrence_rule": parent.recurrence_rule,
                    "recurrence_end": parent.recurrence_end,
                    "is_exception": False,
                    "created_at": parent.created_at,
                }
            )

    return results


def materialize_occurrence(
    parent: CommunityEvent,
    occurrence_date: datetime,
) -> CommunityEvent:
    """Create a new CommunityEvent row as an exception for a virtual occurrence.

    The caller is responsible for adding the returned object to the DB session,
    flushing, and handling IntegrityError (race condition).
    """
    return CommunityEvent(
        community_id=parent.community_id,
        title=parent.title,
        description=parent.description,
        date=occurrence_date,
        meeting_latitude=parent.meeting_latitude,
        meeting_longitude=parent.meeting_longitude,
        parent_event_id=parent.id,
        is_cancelled=False,
    )
