from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_session

SessionDep = Annotated[AsyncSession, Depends(get_session)]

_bearer = HTTPBearer(auto_error=False)

CSRF_HEADER = "X-CSRF-Protection"


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise AppError(401, "not_authenticated", "Not authenticated")
    try:
        user_id = decode_access_token(credentials.credentials)
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise AppError(401, "invalid_token", "Invalid or expired access token") from exc
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "invalid_token", "Invalid or expired access token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_csrf_header(request: Request) -> None:
    """Cookie-authenticated endpoints require a custom header.

    Browsers can't attach custom headers to cross-site requests without a CORS preflight,
    which our CORS allowlist rejects, so this blocks CSRF on the refresh-token cookie.
    """
    if request.headers.get(CSRF_HEADER) != "1":
        raise AppError(403, "csrf_header_missing", f"Missing {CSRF_HEADER} header")
