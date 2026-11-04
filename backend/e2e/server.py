"""Backend for the Playwright end-to-end tests: `python -m e2e.server` (from backend/).

Runs on port 8001 against a fresh `aitutor_e2e` database and Redis DB 14, with the mock AI and
mock speech forced on, so E2E runs never use real API keys or touch development data. The
environment is set before any app module reads settings (it overrides .env).
"""

import asyncio
import os

E2E_ENV = {
    "APP_ENV": "development",
    "POSTGRES_DB": "aitutor_e2e",
    "REDIS_URL": "redis://localhost:6379/14",
    "LLM_PROVIDER": "mock",
    "ANTHROPIC_API_KEY": "",
    "GROQ_API_KEY": "",
    "MOCK_STREAM_DELAY_SECONDS": "0.005",
    "STT_PROVIDER": "mock",
    "TTS_PROVIDER": "mock",
    "GNANI_API_KEY": "",
    "GNANI_STT_ENABLED": "false",
    "GNANI_TTS_ENABLED": "false",
    "CORS_ORIGINS": "http://localhost:5174",
    "FRONTEND_URL": "http://localhost:5174",
    # Journeys create many things quickly; limits are covered by the API tests.
    "AI_RATE_LIMIT": "1000",
    "AUTH_RATE_LIMIT": "1000",
    "SPEECH_RATE_LIMIT": "1000",
    "VIDEO_RATE_LIMIT": "1000",
}
os.environ.update(E2E_ENV)
PORT = 8001

import asyncpg  # noqa: E402
import uvicorn  # noqa: E402
from alembic.config import Config  # noqa: E402

from alembic import command  # noqa: E402
from app.core.config import BACKEND_DIR, get_settings  # noqa: E402
from app.core.redis import close_redis, get_redis  # noqa: E402


async def recreate_database() -> None:
    s = get_settings()
    assert s.postgres_db == "aitutor_e2e"  # never drop anything else
    conn = await asyncpg.connect(
        user=s.postgres_user,
        password=s.postgres_password,
        host=s.postgres_host,
        port=s.postgres_port,
        database="postgres",
    )
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{s.postgres_db}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{s.postgres_db}"')
    finally:
        await conn.close()
    await get_redis().flushdb()
    await close_redis()  # the server runs on a new event loop


def main() -> None:
    asyncio.run(recreate_database())
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")
    uvicorn.run("app.main:app", host="127.0.0.1", port=PORT, log_level="warning")


if __name__ == "__main__":
    main()
