import redis.asyncio as redis
from app.config import REDIS_URL


# Shared Redis client instance (connection pool)
_redis_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    """Returns a shared async Redis client."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,  # 1 секунда на підключення
            socket_timeout=1,  # 1 секунда на операцію
        )
    return _redis_pool


async def close_redis():
    """Close all Redis connections."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None