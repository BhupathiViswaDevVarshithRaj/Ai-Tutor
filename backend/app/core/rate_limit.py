import logging
import time

from fastapi import Request
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


class RateLimiter:
    """Fixed-window limiter per client IP, stored in Redis. Use as a route dependency.

    Fails open (allows the request) if Redis is unavailable, and logs a warning.
    """

    def __init__(self, scope: str, limit: int | None = None, window_seconds: int | None = None):
        self.scope = scope
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        settings = get_settings()
        limit = self.limit or settings.auth_rate_limit
        window = self.window_seconds or settings.auth_rate_window_seconds
        client_ip = request.client.host if request.client else "unknown"
        key = f"rl:{self.scope}:{client_ip}:{int(time.time() // window)}"
        try:
            redis = get_redis()
            count = await redis.incr(key)
            if count == 1:
                await redis.expire(key, window)
        except RedisError:
            logger.warning("rate limiter unavailable (Redis error); allowing request")
            return
        if count > limit:
            raise AppError(429, "rate_limited", "Too many attempts. Please wait and try again.")
