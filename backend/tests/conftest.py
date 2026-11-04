import os
import tempfile

# Point the app at isolated test resources BEFORE any app module reads settings.
os.environ["APP_ENV"] = "test"
os.environ["POSTGRES_DB"] = "aitutor_test"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production-use-0123456789"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["MOCK_STREAM_DELAY_SECONDS"] = "0"
os.environ["STT_PROVIDER"] = "mock"
os.environ["TTS_PROVIDER"] = "mock"
os.environ["GNANI_API_KEY"] = ""
os.environ["GNANI_API_BASE_URL"] = ""
os.environ["GNANI_STT_ENABLED"] = "false"
os.environ["GNANI_TTS_ENABLED"] = "false"
# Rendered test media goes to a throwaway folder, never the real ./media.
os.environ["MEDIA_ROOT"] = tempfile.mkdtemp(prefix="aitutor-media-")

import asyncio  # noqa: E402
import socket  # noqa: E402
from collections.abc import AsyncIterator  # noqa: E402
from dataclasses import dataclass, field  # noqa: E402

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core.config import BACKEND_DIR, get_settings  # noqa: E402
from app.core.redis import close_redis, get_redis  # noqa: E402
from app.db.session import dispose_engine, get_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.mailer import get_mailer  # noqa: E402

API = get_settings().api_prefix


def _port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


async def _ensure_test_database() -> None:
    s = get_settings()
    conn = await asyncpg.connect(
        user=s.postgres_user,
        password=s.postgres_password,
        host=s.postgres_host,
        port=s.postgres_port,
        database="postgres",
    )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", s.postgres_db)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{s.postgres_db}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def database() -> None:
    s = get_settings()
    if not (_port_open(s.postgres_host, s.postgres_port) and _port_open("localhost", 6379)):
        pytest.skip("Postgres/Redis not running. Start them with: docker compose up -d")
    asyncio.run(_ensure_test_database())
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


async def _reset_state() -> None:
    async with get_engine().begin() as conn:
        await conn.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
    await get_redis().flushdb()


@pytest.fixture
async def db(database) -> AsyncIterator[None]:
    """Clean database + Redis for each test. Connections are bound to the test's event loop."""
    await _reset_state()
    yield
    await _reset_state()
    await dispose_engine()
    await close_redis()


@dataclass
class FakeMailer:
    sent: list[dict[str, str]] = field(default_factory=list)

    async def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})


@pytest.fixture
def outbox() -> FakeMailer:
    return FakeMailer()


@pytest.fixture
def app(outbox):
    application = create_app()
    application.dependency_overrides[get_mailer] = lambda: outbox
    return application


@pytest.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def api(db, client) -> AsyncClient:
    """HTTP client backed by a clean test database."""
    return client


async def register_user(
    client: AsyncClient,
    email: str = "learner@example.com",
    password: str = "learning123",
    full_name: str = "Test Learner",
) -> dict[str, str]:
    """Register and return Authorization headers. The refresh cookie lands in client.cookies."""
    resp = await client.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
