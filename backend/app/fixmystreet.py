"""Utility for forwarding reports to FixMyStreet via /report/new/mobile."""

import logging
import mimetypes
import os
import re

import httpx

from app.config import FMS_URL, FMS_SERVICE, IMAGES_DIR_REPORTS

logger = logging.getLogger(__name__)

# FMS returns category options as HTML inside JSON string fields. After
# json-decoding, values look like `value="G|Flytipping"` or `value='Fly tipping'`.
_FMS_OPTION_VALUE_RE = re.compile(r"""value=['"]([^'"]+)['"]""")

# Sub-question answers that show up alongside categories in the same response
# but aren't real category values.
_FMS_NON_CATEGORY_VALUES = {
    "yes",
    "no",
    "other",
    "front_garden",
    "back_garden",
    "commercial_property",
}

# Preference order when matching against the bare category name (after any
# `G|` group prefix). First match wins.
_FMS_CATEGORY_KEYWORDS = ["flytipping", "fly tipping", "fly-tipping", "rubbish", "litter"]


class FixMyStreetError(Exception):
    """Raised when a FixMyStreet submission fails."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _build_session() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": "MapTheMess/1.0"},
        timeout=30,
        follow_redirects=True,
    )


def _resolve_fms_categorisation(
    client: httpx.Client, lat: float, lon: float
) -> dict[str, str] | None:
    """Look up the FMS category form fields at lat/lon that best match fly-tipping.

    Returns a dict of form fields to send (always includes `category`, and may
    include a `category.<group>` subcategory when the council requires one),
    or None if no fly-tipping option exists at this location.
    """
    try:
        resp = client.get(
            f"{FMS_URL}/report/new/ajax",
            params={"latitude": str(lat), "longitude": str(lon), "w": "1"},
        )
        if resp.status_code != 200:
            logger.warning(
                "FMS category lookup non-200 for %s, %s: status %s", lat, lon, resp.status_code
            )
            return None
        payload = resp.json()
    except Exception:
        logger.warning("FMS category lookup failed for %s, %s", lat, lon, exc_info=True)
        return None

    haystack = "".join(v for v in payload.values() if isinstance(v, str))
    candidates = [
        v for v in _FMS_OPTION_VALUE_RE.findall(haystack) if v.lower() not in _FMS_NON_CATEGORY_VALUES
    ]
    if not candidates:
        logger.warning("FMS category lookup returned no candidates for %s, %s", lat, lon)
        return None

    def cat_score(opt: str) -> tuple[int, int, int]:
        bare = opt.split("|", 1)[-1].lower()
        for i, kw in enumerate(_FMS_CATEGORY_KEYWORDS):
            if kw in bare:
                # (keyword rank, top-level preference, length tiebreaker — lower wins)
                return (i, 0 if opt.startswith("G|") else 1, len(opt))
        return (len(_FMS_CATEGORY_KEYWORDS), 0, 0)

    best = min(candidates, key=cat_score)
    if cat_score(best)[0] >= len(_FMS_CATEGORY_KEYWORDS):
        logger.warning(
            "FMS category lookup found no fly-tipping match at %s, %s", lat, lon
        )
        return None

    # The `G|` prefix is a UI-only group marker — FMS's mobile endpoint expects
    # the leaf subcategory value as `category`, not the parent group. So when
    # we matched a group, find its subcategory fieldset and use the best leaf
    # value as the actual `category`.
    if best.startswith("G|"):
        bare_key = re.sub(r"[^A-Za-z0-9]", "", best[2:])
        fieldset_re = re.compile(
            rf'<fieldset[^>]*id="subcategory_{re.escape(bare_key)}"[^>]*>(.*?)</fieldset>',
            re.DOTALL,
        )
        fieldset_match = fieldset_re.search(payload.get("subcategories", ""))
        if not fieldset_match:
            logger.warning(
                "FMS group %r at %s, %s has no subcategory fieldset", best, lat, lon
            )
            return None
        sub_values = re.findall(
            rf'name="category\.{re.escape(bare_key)}"[^>]*value=[\'"]([^\'"]+)[\'"]',
            fieldset_match.group(1),
        )
        if not sub_values:
            logger.warning(
                "FMS group %r at %s, %s has empty subcategory list", best, lat, lon
            )
            return None

        def sub_score(s: str) -> tuple[int, int]:
            sl = s.lower()
            for i, kw in enumerate(_FMS_CATEGORY_KEYWORDS):
                if kw in sl:
                    return (i, len(s))
            return (len(_FMS_CATEGORY_KEYWORDS), len(s))

        leaf = min(sub_values, key=sub_score)
        fields = {"category": leaf}
    else:
        fields = {"category": best}

    logger.warning("FMS category resolved for %s, %s: %s", lat, lon, fields)
    return fields


def _pick_extra_default(code: str, values: list[dict]) -> str | None:
    """Pick a safe default value for a required FMS category-extra field."""
    keys = [v.get("key") for v in values if isinstance(v, dict) and v.get("key")]
    if not keys:
        return None
    by_lower = {k.lower(): k for k in keys}
    code_l = code.lower()

    # Yes/No question → answer "No"
    if {"yes", "no"} <= set(by_lower) and len(by_lower) == 2:
        return by_lower["no"]

    # Location/land-type field → prefer Public land / Roadside
    if any(kw in code_l for kw in ("land", "location", "area", "where")):
        for keyword in ("public", "roadside", "footpath"):
            for kl, k in by_lower.items():
                if keyword in kl:
                    return k

    # Generic fallback: prefer "Other" if present, else first option
    if "other" in by_lower:
        return by_lower["other"]
    return keys[0]


def _resolve_fms_extras(
    client: httpx.Client, lat: float, lon: float, category: str
) -> dict[str, str]:
    """Fetch required category-extras for a category and pick safe defaults."""
    try:
        resp = client.post(
            f"{FMS_URL}/report/new/category_extras",
            data={"latitude": str(lat), "longitude": str(lon), "category": category},
        )
        if resp.status_code != 200:
            logger.warning(
                "FMS extras lookup non-200 for %s, %s, %s: status %s",
                lat, lon, category, resp.status_code,
            )
            return {}
        payload = resp.json()
    except Exception:
        logger.warning(
            "FMS extras lookup failed for %s, %s, %s", lat, lon, category, exc_info=True
        )
        return {}

    fields: dict[str, str] = {}
    for entry in payload.get("category_extra_json") or []:
        if not entry.get("required"):
            continue
        code = entry.get("code")
        values = entry.get("values") or []
        if not code:
            continue
        chosen = _pick_extra_default(code, values)
        if chosen is not None:
            fields[code] = chosen
    return fields


def _upload_photo(client: httpx.Client, image_filename: str) -> str | None:
    """Upload a photo to FixMyStreet and return the upload file ID."""
    path = os.path.join(IMAGES_DIR_REPORTS, image_filename)
    if not os.path.isfile(path):
        logger.warning("Image file not found for FMS upload: %s", path)
        return None
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        resp = client.post(f"{FMS_URL}/photo/upload", files={"photo1": (image_filename, f, mime)})
    if resp.status_code == 200:
        data = resp.json()
        if data.get("id"):
            return data["id"]
    logger.warning("FMS photo upload failed: %s %s", resp.status_code, resp.text[:200])
    return None


def submit_to_fixmystreet(
    *,
    email: str,
    name: str,
    lat: float,
    lon: float,
    title: str,
    detail: str,
    category: str,
    image_filename: str | None = None,
    phone: str = "",
    extra: dict[str, str] | None = None,
) -> dict:
    """
    Submit a report to FixMyStreet via /report/new/mobile.

    The user's email is used for the submission — FixMyStreet will send
    them a confirmation email to finalise the report.

    Returns a dict with keys:
      - success: bool
      - report_url: str | None (if a report ID was returned)
      - message: str
    """
    client = _build_session()

    category_fields = _resolve_fms_categorisation(client, lat, lon) or {"category": category}
    extras = _resolve_fms_extras(client, lat, lon, category_fields["category"])

    upload_fileid = ""
    if image_filename:
        upload_fileid = _upload_photo(client, image_filename) or ""

    data = {
        "latitude": str(lat),
        "longitude": str(lon),
        "title": title,
        "detail": detail,
        "name": name,
        "username_register": email,
        "phone": phone,
        "submit_problem": "1",
        "submit_register": "1",
        "may_show_name": "1",
        "service": FMS_SERVICE,
        "pc": "",
    }
    data.update(category_fields)
    data.update(extras)
    if upload_fileid:
        data["upload_fileid"] = upload_fileid
    if extra:
        data.update(extra)

    logger.warning("FMS submission to %s: %s", f"{FMS_URL}/report/new/mobile", data)

    resp = client.post(f"{FMS_URL}/report/new/mobile", data=data)

    ct = resp.headers.get("content-type", "")
    if "json" not in ct:
        raise FixMyStreetError(
            f"FixMyStreet returned HTML instead of JSON (status {resp.status_code})",
            resp.status_code,
        )

    result = resp.json()
    report_url = None
    if result.get("success") and result.get("report"):
        report_url = f"{FMS_URL}/report/{result['report']}"

    if result.get("errors"):
        error_details = "; ".join(f"{k}: {v}" for k, v in result["errors"].items())
        logger.error("FMS rejected submission. Sent: %s. Errors: %s", data, error_details)
        raise FixMyStreetError(f"Validation errors: {error_details}")

    return {
        "success": bool(result.get("success")),
        "report_url": report_url,
        "message": str(result),
    }
