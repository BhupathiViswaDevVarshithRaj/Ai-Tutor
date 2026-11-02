import asyncio
import time
from collections.abc import Awaitable, Callable

from sqlalchemy import text

from app.core.config import get_settings
from app.core.redis import get_redis
from app.db.session import get_engine

HealthCheck = Callable[[], Awaitable[None]]


async def check_database() -> None:
    async with get_engine().connect() as conn:
        await conn.execute(text("SELECT 1"))


async def check_redis() -> None:
    if not await get_redis().ping():
        raise RuntimeError("Redis PING returned a falsy response")


def default_checks() -> dict[str, HealthCheck]:
    return {"database": check_database, "redis": check_redis}


async def run_checks(checks: dict[str, HealthCheck]) -> dict[str, dict[str, object]]:
    """Run all checks concurrently, each bounded by a timeout. Never raises."""
    timeout = get_settings().health_check_timeout_seconds

    async def _run(check: HealthCheck) -> dict[str, object]:
        started = time.perf_counter()
        try:
            await asyncio.wait_for(check(), timeout=timeout)
            status, error = "ok", None
        except TimeoutError:
            status, error = "error", f"timed out after {timeout}s"
        except Exception as exc:  # noqa: BLE001 - report any dependency failure
            status, error = "error", f"{type(exc).__name__}: {exc}"
        result: dict[str, object] = {
            "status": status,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
        if error:
            result["error"] = error
        return result

    names = list(checks)
    results = await asyncio.gather(*(_run(checks[name]) for name in names))
    return dict(zip(names, results, strict=True))
