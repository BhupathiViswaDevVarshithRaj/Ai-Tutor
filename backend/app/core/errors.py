from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.ai.llm.base import LLMError, LLMRefusal


class AppError(Exception):
    """Expected, user-facing error. Rendered as {"detail": message, "code": code}."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class NotFound(AppError):
    def __init__(self, what: str = "Resource") -> None:
        super().__init__(404, "not_found", f"{what} not found")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.message, "code": exc.code}
        )

    @app.exception_handler(LLMError)
    async def _llm_error(_: Request, exc: LLMError) -> JSONResponse:
        refused = isinstance(exc, LLMRefusal)
        return JSONResponse(
            status_code=422 if refused else 503,
            content={
                "detail": exc.user_message,
                "code": "ai_refused" if refused else "ai_unavailable",
            },
        )
