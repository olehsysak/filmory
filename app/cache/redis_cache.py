import json
from typing import Any
from app.cache.redis_client import get_redis


class RedisCache:
    async def get(self, key: str) -> Any | None:
        """Get cached value by key."""
        try:
            redis = await get_redis()
            data = await redis.get(key)
            if data is None:
                return None
            # Deserialize JSON string to Python object
            return json.loads(data)
        except Exception:
            return None


    async def set(self, key: str, value: Any, ttl: int) -> None:
        """Set value to Redis with expiration time."""
        try:
            redis = await get_redis()
            await redis.set(key, json.dumps(value), ex=ttl)
        except Exception:
            pass


    async def delete(self, key: str) -> None:
        """Remove cached value by key."""
        redis = await get_redis()
        await redis.delete(key)


redis_cache = RedisCache()