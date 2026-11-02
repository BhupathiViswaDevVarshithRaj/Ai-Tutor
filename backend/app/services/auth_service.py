"""Registration, login, refresh-token rotation, logout and password reset."""

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    dummy_password_hash,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)
from app.db.models import PasswordResetToken, RefreshToken, User, UserPreferences
from app.schemas.auth import RegisterRequest
from app.services.mailer import Mailer

logger = logging.getLogger(__name__)

# A refresh token revoked this recently was most likely rotated by a concurrent request
# (e.g. two tabs refreshing at once), not stolen, so we don't revoke the whole session family.
ROTATION_GRACE = timedelta(seconds=30)

INVALID_CREDENTIALS = AppError(401, "invalid_credentials", "Incorrect email or password")
INVALID_REFRESH = AppError(401, "invalid_refresh_token", "Session expired. Please sign in again.")


@dataclass
class IssuedTokens:
    access_token: str
    expires_in: int
    refresh_token: str


def _now() -> datetime:
    return datetime.now(UTC)


async def _hash(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)  # argon2 is CPU-bound


async def _verify(password_hash: str, password: str) -> bool:
    return await asyncio.to_thread(verify_password, password_hash, password)


async def _revoke_all_refresh_tokens(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


async def _issue_tokens(
    session: AsyncSession, user: User, user_agent: str | None
) -> tuple[IssuedTokens, RefreshToken]:
    raw, token_hash = new_opaque_token()
    record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=_now() + timedelta(days=get_settings().refresh_token_ttl_days),
        user_agent=(user_agent or "")[:255] or None,
    )
    session.add(record)
    await session.flush()
    access, expires_in = create_access_token(user.id)
    return IssuedTokens(access, expires_in, raw), record


async def register(
    session: AsyncSession, data: RegisterRequest, user_agent: str | None
) -> tuple[User, IssuedTokens]:
    user = User(
        email=str(data.email).lower(),
        password_hash=await _hash(data.password),
        full_name=data.full_name,
        preferences=UserPreferences(),
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(409, "email_taken", "An account with this email already exists") from exc
    tokens, _ = await _issue_tokens(session, user, user_agent)
    await session.commit()
    await session.refresh(user)
    return user, tokens


async def login(
    session: AsyncSession, email: str, password: str, user_agent: str | None
) -> tuple[User, IssuedTokens]:
    user = await session.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        await _verify(dummy_password_hash(), password)  # equalise timing
        raise INVALID_CREDENTIALS
    if not await _verify(user.password_hash, password) or not user.is_active:
        raise INVALID_CREDENTIALS
    user.last_login_at = _now()
    tokens, _ = await _issue_tokens(session, user, user_agent)
    await session.commit()
    await session.refresh(user)
    return user, tokens


async def rotate_refresh_token(
    session: AsyncSession, raw: str | None, user_agent: str | None
) -> tuple[User, IssuedTokens]:
    if not raw:
        raise INVALID_REFRESH
    record = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)).with_for_update()
    )
    if record is None:
        raise INVALID_REFRESH

    now = _now()
    if record.revoked_at is not None:
        if record.replaced_by is not None and now - record.revoked_at < ROTATION_GRACE:
            raise AppError(401, "refresh_race", "Session was refreshed by another request")
        # Reuse of a rotated token: treat as theft and end every session for this user.
        logger.warning("refresh token reuse detected for user %s", record.user_id)
        await _revoke_all_refresh_tokens(session, record.user_id)
        await session.commit()
        raise INVALID_REFRESH
    if record.expires_at <= now:
        raise INVALID_REFRESH

    user = await session.get(User, record.user_id)
    if user is None or not user.is_active:
        raise INVALID_REFRESH

    tokens, new_record = await _issue_tokens(session, user, user_agent)
    record.revoked_at = now
    record.replaced_by = new_record.id
    await session.commit()
    await session.refresh(user)
    return user, tokens


async def logout(session: AsyncSession, raw: str | None) -> None:
    if not raw:
        return
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    await session.commit()


async def request_password_reset(session: AsyncSession, email: str, mailer: Mailer) -> None:
    """Always succeeds from the caller's view, so it can't be used to discover accounts."""
    user = await session.scalar(select(User).where(User.email == email.lower()))
    if user is None or not user.is_active:
        return
    # Only the newest link stays valid.
    await session.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=_now())
    )
    raw, token_hash = new_opaque_token()
    settings = get_settings()
    session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=_now() + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    await session.commit()
    link = f"{settings.frontend_url}/reset-password?token={raw}"
    await mailer.send(
        user.email,
        "Reset your AI Tutor password",
        f"Hi {user.full_name},\n\nUse this link to set a new password. "
        f"It expires in {settings.password_reset_ttl_minutes} minutes.\n\n{link}\n\n"
        "If you didn't ask for this, you can ignore this email.",
    )


async def confirm_password_reset(session: AsyncSession, raw: str, new_password: str) -> None:
    record = await session.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == hash_token(raw))
        .with_for_update()
    )
    if record is None or record.used_at is not None or record.expires_at <= _now():
        raise AppError(400, "invalid_reset_token", "This reset link is invalid or has expired")
    user = await session.get(User, record.user_id)
    if user is None:
        raise AppError(400, "invalid_reset_token", "This reset link is invalid or has expired")
    user.password_hash = await _hash(new_password)
    record.used_at = _now()
    await _revoke_all_refresh_tokens(session, user.id)
    await session.commit()


async def change_password(
    session: AsyncSession, user: User, current: str, new: str, user_agent: str | None
) -> IssuedTokens:
    """Change password, sign out every other session, and return fresh tokens for this one."""
    if not await _verify(user.password_hash, current):
        raise AppError(400, "invalid_current_password", "Current password is incorrect")
    user.password_hash = await _hash(new)
    await _revoke_all_refresh_tokens(session, user.id)
    tokens, _ = await _issue_tokens(session, user, user_agent)
    await session.commit()
    return tokens
