from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status

from app.api.deps import CurrentUser, SessionDep, require_csrf_header
from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.services import auth_service
from app.services.mailer import Mailer, get_mailer

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()
RefreshCookie = Annotated[str | None, Cookie(alias=_settings.refresh_cookie_name)]
CSRF = [Depends(require_csrf_header)]


def _set_refresh_cookie(response: Response, raw: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw,
        max_age=settings.refresh_token_ttl_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=f"{settings.api_prefix}/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=f"{settings.api_prefix}/auth",
    )


def _token_response(response: Response, user, tokens: auth_service.IssuedTokens) -> TokenResponse:
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        user=UserOut.model_validate(user),
    )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter("register"))],
)
async def register(
    data: RegisterRequest, request: Request, response: Response, session: SessionDep
) -> TokenResponse:
    user, tokens = await auth_service.register(session, data, request.headers.get("user-agent"))
    return _token_response(response, user, tokens)


@router.post("/login", dependencies=[Depends(RateLimiter("login"))])
async def login(
    data: LoginRequest, request: Request, response: Response, session: SessionDep
) -> TokenResponse:
    user, tokens = await auth_service.login(
        session, str(data.email), data.password, request.headers.get("user-agent")
    )
    return _token_response(response, user, tokens)


@router.post("/refresh", dependencies=CSRF)
async def refresh(
    request: Request, response: Response, session: SessionDep, refresh_token: RefreshCookie = None
) -> TokenResponse:
    user, tokens = await auth_service.rotate_refresh_token(
        session, refresh_token, request.headers.get("user-agent")
    )
    return _token_response(response, user, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=CSRF)
async def logout(
    response: Response, session: SessionDep, refresh_token: RefreshCookie = None
) -> None:
    await auth_service.logout(session, refresh_token)
    _clear_refresh_cookie(response)


@router.post(
    "/password-reset/request",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(RateLimiter("password-reset"))],
)
async def request_password_reset(
    data: PasswordResetRequest,
    session: SessionDep,
    mailer: Annotated[Mailer, Depends(get_mailer)],
) -> dict[str, str]:
    await auth_service.request_password_reset(session, str(data.email), mailer)
    return {"detail": "If an account exists for that email, a reset link has been sent."}


@router.post(
    "/password-reset/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RateLimiter("password-reset-confirm"))],
)
async def confirm_password_reset(data: PasswordResetConfirm, session: SessionDep) -> None:
    await auth_service.confirm_password_reset(session, data.token, data.new_password)


@router.post("/change-password", dependencies=CSRF)
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: CurrentUser,
    session: SessionDep,
) -> TokenResponse:
    tokens = await auth_service.change_password(
        session, user, data.current_password, data.new_password, request.headers.get("user-agent")
    )
    return _token_response(response, user, tokens)
