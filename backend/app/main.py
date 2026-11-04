from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.v1.speech import SPEECH_HEADERS
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.http import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.db.session import dispose_engine
from app.services.video_service import video_queue


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await dispose_engine()
    await close_redis()
    await video_queue.close()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    # The interactive docs describe every route; they stay off in production.
    docs = settings.app_env != "production"
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    # Added innermost first: CORS stays outermost so even 413s carry CORS headers.
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=settings.max_request_bytes,
        # Audio uploads stream in with their own, larger limit (SPEECH_MAX_AUDIO_BYTES).
        exempt=(f"{settings.api_prefix}/speech/transcribe",),
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.app_env == "production")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=SPEECH_HEADERS,
    )
    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
