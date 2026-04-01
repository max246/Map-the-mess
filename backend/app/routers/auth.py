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

from app.config import IMAGES_DIR, SECRET_KEY, FRONTEND_URL
from app.email import send_email
from app.database import get_db
from app.models.user import User, UserType
from app.models.refresh_token import RefreshToken
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
    Token,
)

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


@router.get("/me", response_model=UserRead)
def get_profile(current_user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return current_user


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
    db.commit()
    db.refresh(current_user)
    return current_user


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
    filename = f"avatar_{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(IMAGES_DIR, filename), format="JPEG", quality=85, optimize=True)

    # Remove old custom avatar file if it exists
    if current_user.avatar_url and str(current_user.avatar_url).startswith("avatar_"):
        old_path = os.path.join(IMAGES_DIR, str(current_user.avatar_url))
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
    if not pwd_context.verify(payload.current_password, current_user.hashed_password):
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
    html = f"""
    <h2>Welcome to Map the Mess!</h2>
    <p>Hi {user.full_name},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="{verify_url}">Verify my email</a></p>
    <p>This link expires in 48 hours.</p>
    <p>If you didn't create this account, you can ignore this email.</p>
    """
    send_email(str(user.email), "Verify your email — Map the Mess", html)


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
    if not user or not pwd_context.verify(payload.password, user.hashed_password):
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
    html = f"""
    <h2>Password Reset — Map the Mess</h2>
    <p>Hi {user.full_name},</p>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="{reset_url}">Reset my password</a></p>
    <p>This link expires in {RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
    <p>If you didn't request this, you can ignore this email.</p>
    """
    send_email(str(user.email), "Password reset — Map the Mess", html)
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
