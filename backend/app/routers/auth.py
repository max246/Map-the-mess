"""Auth routes — user registration, login, and role management."""

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from PIL import Image
from sqlalchemy.orm import Session

from app.badges import evaluate_badges
from app.config import IMAGES_DIR, IMAGES_DIR_AVATARS, SECRET_KEY, FRONTEND_URL
from app.email import render_email, send_email
from app.database import get_db
from app.models.user import User, UserType
from app.models.community import Community
from app.models.report import Report
from app.models.refresh_token import RefreshToken
from app.models.oauth_account import OAuthAccount
from app.schemas.user import (
    ChangePassword,
    ProfileUpdate,
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdateType,
    ForgotPassword,
    ResetPassword,
    RefreshRequest,
    SocialLoginRequest,
    Token,
)
from app.services.oauth import get_verifier, OAuthIdentity, OAuthVerifyError

router = APIRouter()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
AVATAR_MAX_SIZE = (300, 300)
AVATAR_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
REFRESH_TOKEN_EXPIRE_DAYS = 30
RESET_TOKEN_EXPIRE_MINUTES = 15
VERIFY_TOKEN_EXPIRE_HOURS = 48

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _create_refresh_token(user_id: uuid.UUID, db: Session) -> str:
    """Create an opaque refresh token and store it in the database."""
    token = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(token=token, user_id=user_id, expires_at=expires_at))
    db.commit()
    return token


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def _user_read(db: Session, user: User) -> UserRead:
    data = UserRead.model_validate(user)
    data.badges = evaluate_badges(db, user)
    data.has_password = bool(user.hashed_password)
    data.linked_providers = sorted(
        row.provider
        for row in db.query(OAuthAccount.provider).filter(OAuthAccount.user_id == user.id).all()
    )
    return data


@router.get("/me", response_model=UserRead)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's profile."""
    return _user_read(db, current_user)


@router.patch("/me", response_model=UserRead)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile (name, avatar_url)."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name  # type: ignore[assignment]
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url  # type: ignore[assignment]
    if payload.city_latitude is not None:
        current_user.city_latitude = payload.city_latitude  # type: ignore[assignment]
    if payload.city_longitude is not None:
        current_user.city_longitude = payload.city_longitude  # type: ignore[assignment]
    db.commit()
    db.refresh(current_user)
    return _user_read(db, current_user)


@router.delete("/me", status_code=204)
def delete_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete current user profile"""
    community = db.query(Community).filter(Community.owner_id == current_user.id).first()
    if community:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You own a community. Transfer ownership before deleting your account.",
        )

    db.query(Report).filter(Report.created_by_user_id == current_user.id).update(
        {Report.created_by_user_id: None}
    )
    db.query(Report).filter(Report.resolved_by_user_id == current_user.id).update(
        {Report.resolved_by_user_id: None}
    )

    db.delete(current_user)
    db.commit()


@router.put("/me/avatar", response_model=UserRead)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a custom avatar image. Resized to 300x300 max."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in AVATAR_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Must be one of: {', '.join(AVATAR_ALLOWED_EXTENSIONS)}",
        )
    try:
        img = Image.open(BytesIO(file.file.read()))
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read image file")

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    img.thumbnail(AVATAR_MAX_SIZE, Image.Resampling.LANCZOS)
    os.makedirs(IMAGES_DIR_AVATARS, exist_ok=True)
    filename = f"avatar_{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(IMAGES_DIR_AVATARS, filename), format="JPEG", quality=85, optimize=True)

    # Remove old custom avatar file if it exists
    if current_user.avatar_url and str(current_user.avatar_url).startswith("avatar_"):
        old_path = os.path.join(IMAGES_DIR_AVATARS, str(current_user.avatar_url))
        if os.path.isfile(old_path):
            os.remove(old_path)

    current_user.avatar_url = filename  # type: ignore[assignment]
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/password")
def change_password(
    payload: ChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password. Requires current password."""
    if not current_user.hashed_password or not pwd_context.verify(
        payload.current_password, current_user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.hashed_password = pwd_context.hash(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type not in (UserType.superuser, UserType.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_moderator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type not in (UserType.superuser, UserType.admin, UserType.moderator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator or admin access required",
        )
    return current_user


def _send_verification_email(user: User) -> None:
    """Generate a verification token and email it to the user."""
    expire = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_EXPIRE_HOURS)
    token = jwt.encode(
        {"sub": user.email, "purpose": "email-verification", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"
    html, text = render_email(
        "verify_email",
        user_name=user.full_name,
        verify_url=verify_url,
        expire_hours=VERIFY_TOKEN_EXPIRE_HOURS,
    )
    send_email(str(user.email), "Verify your email — Map the Mess", html, text)


@router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """List all users. Requires admin access."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/register", response_model=UserRead)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=pwd_context.hash(payload.password),
        city_latitude=payload.city_latitude,
        city_longitude=payload.city_longitude,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _send_verification_email(user)
    return user


@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify a user's email address using the token from the verification email."""
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("purpose") != "email-verification":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token",
            )
        email = data.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token",
        )

    if user.is_verified:
        return {"message": "Email already verified"}

    user.is_verified = True  # type: ignore[assignment]
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
def resend_verification(payload: ForgotPassword, db: Session = Depends(get_db)):
    """Resend the verification email. Uses ForgotPassword schema (just an email field)."""
    user = db.query(User).filter(User.email == payload.email).first()
    if user and not user.is_verified:
        _send_verification_email(user)
    # Don't reveal whether the user exists
    return {"message": "If the email exists and is unverified, a verification email has been sent"}


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if (
        not user
        or not user.hashed_password
        or not pwd_context.verify(payload.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )

    access = create_access_token(
        {"sub": user.email, "type": user.user_type.value, "user_id": str(user.id)}
    )
    refresh = _create_refresh_token(user.id, db)  # type: ignore[arg-type]
    return {"access_token": access, "refresh_token": refresh}


@router.post("/refresh", response_model=Token)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token + refresh token (rotation)."""
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == payload.refresh_token, RefreshToken.revoked.is_(False))
        .first()
    )
    if not stored or stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Revoke the old refresh token (rotation)
    stored.revoked = True  # type: ignore[assignment]

    access = create_access_token(
        {"sub": user.email, "type": user.user_type.value, "user_id": str(user.id)}
    )
    new_refresh = _create_refresh_token(user.id, db)  # type: ignore[arg-type]
    return {"access_token": access, "refresh_token": new_refresh}


def _link_or_create_oauth_user(db: Session, identity: OAuthIdentity) -> User:
    """Find, link, or create a user from a verified OAuth identity.

    Merge rules (see PR description):
      - existing oauth row -> sign in that user
      - no oauth row, no user with this email -> create new (verified) user
      - no oauth row, user with this email is verified -> auto-link
      - no oauth row, user with this email is NOT verified -> reject (takeover risk)
    """
    if not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not verified by provider",
        )

    existing_link = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == identity.provider,
            OAuthAccount.provider_account_id == identity.provider_account_id,
        )
        .first()
    )
    if existing_link:
        user = db.query(User).filter(User.id == existing_link.user_id).first()
        if user is None:
            # Orphaned link — clean up and fall through to create
            db.delete(existing_link)
            db.commit()
        else:
            return user

    user = db.query(User).filter(User.email == identity.email).first()
    if user is not None:
        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An unverified account already exists for this email. "
                    "Please verify it before linking a social login."
                ),
            )
        db.add(
            OAuthAccount(
                user_id=user.id,
                provider=identity.provider,
                provider_account_id=identity.provider_account_id,
            )
        )
        db.commit()
        db.refresh(user)
        return user

    user = User(
        email=identity.email,
        full_name=identity.full_name or identity.email.split("@")[0],
        hashed_password=None,
        is_verified=True,
    )
    db.add(user)
    db.flush()
    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=identity.provider,
            provider_account_id=identity.provider_account_id,
        )
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/{provider}/login", response_model=Token)
def social_login(
    provider: str,
    payload: SocialLoginRequest,
    db: Session = Depends(get_db),
):
    """Sign in (or sign up) using a verified social provider credential."""
    identity = _verify_provider_credential(provider, payload.credential)
    user = _link_or_create_oauth_user(db, identity)
    access = create_access_token(
        {"sub": user.email, "type": user.user_type.value, "user_id": str(user.id)}
    )
    refresh = _create_refresh_token(user.id, db)  # type: ignore[arg-type]
    return {"access_token": access, "refresh_token": refresh}


def _verify_provider_credential(provider: str, credential: str):
    verifier = get_verifier(provider)
    if verifier is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}",
        )
    try:
        identity = verifier.verify(credential)
    except OAuthVerifyError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    if not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not verified by provider",
        )
    return identity


@router.post("/{provider}/link", response_model=UserRead)
def link_provider(
    provider: str,
    payload: SocialLoginRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a provider identity to the currently authenticated user."""
    identity = _verify_provider_credential(provider, payload.credential)

    existing = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == identity.provider,
            OAuthAccount.provider_account_id == identity.provider_account_id,
        )
        .first()
    )
    if existing is not None:
        if existing.user_id == current_user.id:
            return _user_read(db, current_user)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Google account is already linked to a different user.",
        )

    db.add(
        OAuthAccount(
            user_id=current_user.id,
            provider=identity.provider,
            provider_account_id=identity.provider_account_id,
        )
    )
    db.commit()
    db.refresh(current_user)
    return _user_read(db, current_user)


@router.delete("/{provider}/link", response_model=UserRead)
def unlink_provider(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detach a provider from the current user. Refuses if it would lock them out."""
    if get_verifier(provider) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}",
        )

    link = (
        db.query(OAuthAccount)
        .filter(OAuthAccount.user_id == current_user.id, OAuthAccount.provider == provider)
        .first()
    )
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} account linked.",
        )

    other_links = (
        db.query(OAuthAccount)
        .filter(OAuthAccount.user_id == current_user.id, OAuthAccount.id != link.id)
        .count()
    )
    if not current_user.hashed_password and other_links == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "You'd be locked out of your account. "
                "Set a password before disconnecting your only sign-in method."
            ),
        )

    db.delete(link)
    db.commit()
    db.refresh(current_user)
    return _user_read(db, current_user)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke a refresh token on logout."""
    stored = db.query(RefreshToken).filter(RefreshToken.token == payload.refresh_token).first()
    if stored:
        stored.revoked = True  # type: ignore[assignment]
        db.commit()


@router.patch("/users/{user_id}/type", response_model=UserRead)
def update_user_type(
    user_id: uuid.UUID,
    payload: UserUpdateType,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    try:
        new_type = UserType(payload.user_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user type. Must be one of: {', '.join(t.value for t in UserType)}",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if target_user.user_type == UserType.superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change superuser type",
        )

    target_user.user_type = new_type  # type: ignore[assignment]
    db.commit()
    db.refresh(target_user)
    return target_user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if target_user.user_type == UserType.superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete a superuser",
        )
    if target_user.user_type == UserType.admin and admin.user_type != UserType.superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a superuser can delete an admin",
        )
    community = db.query(Community).filter(Community.owner_id == target_user.id).first()
    if community:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User owns community '{community.name}'. Transfer ownership before deleting.",
        )

    db.query(Report).filter(Report.created_by_user_id == target_user.id).update(
        {Report.created_by_user_id: None}
    )
    db.query(Report).filter(Report.resolved_by_user_id == target_user.id).update(
        {Report.resolved_by_user_id: None}
    )

    db.delete(target_user)
    db.commit()


@router.post("/forgot-password")
def forgot_password(payload: ForgotPassword, db: Session = Depends(get_db)):
    """Generate a password reset token for the given email."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Don't reveal whether the user exists
        return {"message": "If the email exists, a reset token has been generated"}

    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    reset_token = jwt.encode(
        {"sub": user.email, "purpose": "password-reset", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    html, text = render_email(
        "password_reset",
        user_name=user.full_name,
        reset_url=reset_url,
        expire_minutes=RESET_TOKEN_EXPIRE_MINUTES,
    )
    send_email(str(user.email), "Password reset — Map the Mess", html, text)
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
def reset_password(payload: ResetPassword, db: Session = Depends(get_db)):
    """Reset a user's password using a valid reset token."""
    try:
        data = jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("purpose") != "password-reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token",
            )
        email = data.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token",
        )

    user.hashed_password = pwd_context.hash(payload.new_password)
    db.commit()
    return {"message": "Password has been reset successfully"}
