import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

JWT_ALGORITHM = "HS256"

_hasher = PasswordHasher()  # argon2id with library-recommended parameters


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


@lru_cache
def dummy_password_hash() -> str:
    """Verified against when an email is unknown, so login timing doesn't reveal accounts."""
    return _hasher.hash(secrets.token_urlsafe(16))


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """Return (jwt, lifetime_seconds)."""
    settings = get_settings()
    now = datetime.now(UTC)
    ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    token = jwt.encode(
        {"sub": str(user_id), "type": "access", "iat": now, "exp": now + ttl},
        settings.secret_key,
        algorithm=JWT_ALGORITHM,
    )
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> uuid.UUID:
    """Raise jwt.InvalidTokenError (or ValueError) if the token is invalid or expired."""
    payload = jwt.decode(
        token,
        get_settings().secret_key,
        algorithms=[JWT_ALGORITHM],
        options={"require": ["exp", "sub", "type"]},
    )
    if payload["type"] != "access":
        raise jwt.InvalidTokenError("not an access token")
    return uuid.UUID(payload["sub"])


def new_opaque_token() -> tuple[str, str]:
    """Return (raw token for the client, sha256 hash for storage)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
