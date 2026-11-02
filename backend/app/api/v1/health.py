from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.config import get_settings
from app.services.health import HealthCheck, default_checks, run_checks

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def liveness() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}


@router.get("/ready")
async def readiness(
    response: Response,
    checks: Annotated[dict[str, HealthCheck], Depends(default_checks)],
) -> dict[str, object]:
    results = await run_checks(checks)
    ready = all(r["status"] == "ok" for r in results.values())
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if ready else "degraded", "checks": results}
