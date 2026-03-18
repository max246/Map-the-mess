"""Auth routes — user registration, login, and role management."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, FRONTEND_URL
from app.email import send_email
from app.database import get_db
from app.models.user import User, UserType
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdateType,
    ForgotPassword,
    ResetPassword,
    Token,
)

router = APIRouter()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
RESET_TOKEN_EXPIRE_MINUTES = 15
VERIFY_TOKEN_EXPIRE_HOURS = 48

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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
    send_email(user.email, "Verify your email — Map the Mess", html)


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

    user.is_verified = True
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

    token = create_access_token({"sub": user.email, "type": user.user_type.value})
    return {"access_token": token}


@router.patch("/users/{user_id}/type", response_model=UserRead)
def update_user_type(
    user_id: int,
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
    user_id: int,
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
    send_email(user.email, "Password reset — Map the Mess", html)
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
