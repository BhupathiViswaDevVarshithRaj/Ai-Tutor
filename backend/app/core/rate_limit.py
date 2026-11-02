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

    Limits are read from settings at request time (`limit_setting` / `window_setting` name the
    fields), so they can be changed via environment variables. Fails open (allows the request)
    if Redis is unavailable, and logs a warning.
    """

    def __init__(
        self,
        scope: str,
        limit_setting: str = "auth_rate_limit",
        window_setting: str = "auth_rate_window_seconds",
    ):
        self.scope = scope
        self.limit_setting = limit_setting
        self.window_setting = window_setting

    async def __call__(self, request: Request) -> None:
        settings = get_settings()
        limit = int(getattr(settings, self.limit_setting))
        window = int(getattr(settings, self.window_setting))
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
