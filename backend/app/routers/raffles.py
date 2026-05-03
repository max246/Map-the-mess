"""Raffle endpoints — admin-managed raffles with prizes drawn from the user pool."""

import os
import random
import uuid as uuid_mod
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.orm import Session

from app.config import IMAGES_DIR_RAFFLES
from app.database import get_db
from app.models.raffle import Raffle, RafflePrize, RafflePrizeImage
from app.models.user import User, UserType
from app.routers.auth import get_current_user, require_admin
from app.schemas.raffle import (
    RaffleCreate,
    RaffleRead,
    RaffleUpdate,
    RafflePrizeCreate,
    RafflePrizeImageRead,
    RafflePrizeRead,
    RafflePrizeUpdate,
    RaffleWinnerContact,
)

router = APIRouter()

PRIZE_IMAGE_SIZE = (1024, 1024)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_raffle_or_404(raffle_id: uuid_mod.UUID, db: Session) -> Raffle:
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Raffle not found")
    return raffle


def _get_prize_or_404(
    raffle_id: uuid_mod.UUID, prize_id: uuid_mod.UUID, db: Session
) -> RafflePrize:
    prize = (
        db.query(RafflePrize)
        .filter(RafflePrize.id == prize_id, RafflePrize.raffle_id == raffle_id)
        .first()
    )
    if not prize:
        raise HTTPException(status_code=404, detail="Prize not found")
    return prize


def _require_not_drawn(raffle: Raffle) -> None:
    if raffle.drawn_at is not None:
        raise HTTPException(status_code=400, detail="Raffle has already been drawn")


def _save_prize_image(file: UploadFile) -> str:
    """Save an uploaded image as JPEG. Returns the filename."""
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

    img.thumbnail(PRIZE_IMAGE_SIZE, Image.Resampling.LANCZOS)
    os.makedirs(IMAGES_DIR_RAFFLES, exist_ok=True)
    filename = f"raffle_{uuid_mod.uuid4().hex}.jpg"
    img.save(
        os.path.join(IMAGES_DIR_RAFFLES, filename),
        format="JPEG",
        quality=85,
        optimize=True,
    )
    return filename


# ---------------------------------------------------------------------------
# Raffle CRUD
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[RaffleRead])
def list_raffles(db: Session = Depends(get_db)):
    """List all raffles. Public."""
    return db.query(Raffle).order_by(Raffle.created_at.desc()).all()


@router.get("/{raffle_id}", response_model=RaffleRead)
def get_raffle(raffle_id: uuid_mod.UUID, db: Session = Depends(get_db)):
    """Get a raffle by id. Public."""
    return _get_raffle_or_404(raffle_id, db)


@router.post("/", response_model=RaffleRead, status_code=201)
def create_raffle(
    payload: RaffleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    raffle = Raffle(
        title=payload.title,
        description=payload.description,
        end_date=payload.end_date,
        created_by=admin.id,
    )
    db.add(raffle)
    db.commit()
    db.refresh(raffle)
    return raffle


@router.patch("/{raffle_id}", response_model=RaffleRead)
def update_raffle(
    raffle_id: uuid_mod.UUID,
    payload: RaffleUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(raffle, key, value)
    db.commit()
    db.refresh(raffle)
    return raffle


@router.delete("/{raffle_id}", status_code=204)
def delete_raffle(
    raffle_id: uuid_mod.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    db.delete(raffle)
    db.commit()


# ---------------------------------------------------------------------------
# Prizes
# ---------------------------------------------------------------------------


@router.post("/{raffle_id}/prizes", response_model=RafflePrizeRead, status_code=201)
def add_prize(
    raffle_id: uuid_mod.UUID,
    payload: RafflePrizeCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)
    prize = RafflePrize(
        raffle_id=raffle.id,
        title=payload.title,
        description=payload.description,
        position=payload.position,
    )
    db.add(prize)
    db.commit()
    db.refresh(prize)
    return prize


@router.patch("/{raffle_id}/prizes/{prize_id}", response_model=RafflePrizeRead)
def update_prize(
    raffle_id: uuid_mod.UUID,
    prize_id: uuid_mod.UUID,
    payload: RafflePrizeUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)
    prize = _get_prize_or_404(raffle_id, prize_id, db)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(prize, key, value)
    db.commit()
    db.refresh(prize)
    return prize


@router.delete("/{raffle_id}/prizes/{prize_id}", status_code=204)
def delete_prize(
    raffle_id: uuid_mod.UUID,
    prize_id: uuid_mod.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)
    prize = _get_prize_or_404(raffle_id, prize_id, db)
    db.delete(prize)
    db.commit()


# ---------------------------------------------------------------------------
# Prize images
# ---------------------------------------------------------------------------


@router.post(
    "/{raffle_id}/prizes/{prize_id}/images",
    response_model=RafflePrizeImageRead,
    status_code=201,
)
def upload_prize_image(
    raffle_id: uuid_mod.UUID,
    prize_id: uuid_mod.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)
    prize = _get_prize_or_404(raffle_id, prize_id, db)

    filename = _save_prize_image(file)
    image = RafflePrizeImage(prize_id=prize.id, url=filename)
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.delete("/{raffle_id}/prizes/{prize_id}/images/{image_id}", status_code=204)
def delete_prize_image(
    raffle_id: uuid_mod.UUID,
    prize_id: uuid_mod.UUID,
    image_id: uuid_mod.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)
    prize = _get_prize_or_404(raffle_id, prize_id, db)
    image = (
        db.query(RafflePrizeImage)
        .filter(
            RafflePrizeImage.id == image_id,
            RafflePrizeImage.prize_id == prize.id,
        )
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    path = os.path.join(IMAGES_DIR_RAFFLES, image.url)
    if os.path.isfile(path):
        os.remove(path)

    db.delete(image)
    db.commit()


@router.get("/images/{filename}")
def serve_prize_image(filename: str):
    """Serve a raffle prize image by filename. Public."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(IMAGES_DIR_RAFFLES, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


# ---------------------------------------------------------------------------
# Draw
# ---------------------------------------------------------------------------


def _eligible_users_query(db: Session):
    """Verified users that aren't admins/superusers."""
    return db.query(User).filter(
        User.is_verified.is_(True),
        User.user_type.in_([UserType.volunteer, UserType.moderator]),
    )


@router.post("/{raffle_id}/draw", response_model=RaffleRead)
def draw_raffle(
    raffle_id: uuid_mod.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Draw winners for the raffle. One random user per prize, no duplicates.

    Eligible pool: verified users with user_type in (volunteer, moderator) — i.e.
    everyone except admins/superusers.
    """
    raffle = _get_raffle_or_404(raffle_id, db)
    _require_not_drawn(raffle)

    if not raffle.prizes:
        raise HTTPException(status_code=400, detail="Raffle has no prizes")

    eligible = _eligible_users_query(db).all()

    if len(eligible) < len(raffle.prizes):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Not enough eligible users to draw: need {len(raffle.prizes)}, "
                f"have {len(eligible)}"
            ),
        )

    winners = random.sample(eligible, len(raffle.prizes))
    shuffled_prizes = list(raffle.prizes)
    random.shuffle(shuffled_prizes)
    for prize, winner in zip(shuffled_prizes, winners):
        prize.winner_user_id = winner.id

    raffle.drawn_at = datetime.utcnow()
    db.commit()
    db.refresh(raffle)
    return raffle


@router.get("/{raffle_id}/winners", response_model=list[RaffleWinnerContact])
def list_winner_contacts(
    raffle_id: uuid_mod.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin-only winner contact details for a drawn raffle."""
    raffle = _get_raffle_or_404(raffle_id, db)
    if raffle.drawn_at is None:
        raise HTTPException(status_code=400, detail="Raffle has not been drawn yet")

    results: list[RaffleWinnerContact] = []
    for prize in sorted(raffle.prizes, key=lambda p: p.position or 0):
        if prize.winner_user_id is None or prize.winner is None:
            continue
        results.append(
            RaffleWinnerContact(
                prize_id=prize.id,
                prize_title=prize.title,
                prize_position=prize.position or 0,
                user_id=prize.winner.id,
                full_name=prize.winner.full_name,
                email=prize.winner.email,
            )
        )
    return results


@router.post("/{raffle_id}/prizes/{prize_id}/redraw", response_model=RafflePrizeRead)
def redraw_prize(
    raffle_id: uuid_mod.UUID,
    prize_id: uuid_mod.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Pick a fresh winner for a single prize (e.g. when the original winner
    isn't responding). Excludes anyone already holding a prize in this raffle —
    including the prize's current winner — so they cannot be re-picked.
    """
    raffle = _get_raffle_or_404(raffle_id, db)
    if raffle.drawn_at is None:
        raise HTTPException(status_code=400, detail="Raffle has not been drawn yet")
    prize = _get_prize_or_404(raffle_id, prize_id, db)

    held_user_ids = {p.winner_user_id for p in raffle.prizes if p.winner_user_id is not None}

    candidates = [u for u in _eligible_users_query(db).all() if u.id not in held_user_ids]
    if not candidates:
        raise HTTPException(
            status_code=400,
            detail="No eligible users left to redraw — everyone has already been picked",
        )

    new_winner = random.choice(candidates)
    prize.winner_user_id = new_winner.id
    db.commit()
    db.refresh(prize)
    return prize
