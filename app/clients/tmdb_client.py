import httpx
import json
from app.config import TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_URL
from app.cache.redis_cache import redis_cache
from app.cache.ttl import TTL
from datetime import date


class TMDBClient:
    def __init__(self):
        self.base_url = TMDB_BASE_URL
        self.api_key = TMDB_API_KEY
        self.image_url = TMDB_IMAGE_URL


    async def _get(self, endpoint: str, params: dict = None) -> dict:
        if params is None:
            params = {}
        params['api_key'] = self.api_key

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            if response.status_code == 204 or not response.content:
                return {}
            return response.json()


    async def _cached_get(self, key: str, endpoint: str, ttl: int, params: dict = None) -> dict:
        """Get from Redis cache or fetch from TMDB."""
        cached = await redis_cache.get(key)
        if cached is not None:
            return cached
        data = await self._get(endpoint, params)
        await redis_cache.set(key, data, ttl)
        return data


    def get_image_url(self, poster_path: str | None, size: str = "w500") -> str | None:
        if not poster_path:
            return None
        return f"https://image.tmdb.org/t/p/{size}{poster_path}"


    async def get_film(self, tmdb_id: int) -> dict:
        return await self._cached_get(
            key=f"tmdb:film:{tmdb_id}",
            endpoint=f"/movie/{tmdb_id}",
            ttl=TTL.FILM,
        )


    async def get_similar(self, tmdb_id: int) -> dict:
        return await self._cached_get(
            key=f"tmdb:similar:{tmdb_id}",
            endpoint=f"/movie/{tmdb_id}/similar",
            ttl=TTL.FILM,
        )


    async def get_credits(self, tmdb_id: int) -> dict:
        return await self._cached_get(
            key=f"tmdb:credits:{tmdb_id}",
            endpoint=f"/movie/{tmdb_id}/credits",
            ttl=TTL.CREDITS,
        )


    async def get_person_film_credits(self, tmdb_id: int) -> dict:
        return await self._cached_get(
            key=f"tmdb:person_credits:{tmdb_id}",
            endpoint=f"/person/{tmdb_id}/movie_credits",
            ttl=TTL.FILM,
        )


    async def get_popular(self, page: int = 1) -> dict:
        return await self._cached_get(
            key=f"tmdb:popular:{page}",
            endpoint="/movie/popular",
            ttl=TTL.POPULAR,
            params={"page": page},
        )


    async def get_top_rated(self, page: int = 1) -> dict:
        return await self._cached_get(
            key=f"tmdb:top_rated:{page}",
            endpoint="/movie/top_rated",
            ttl=TTL.TOP_RATED,
            params={"page": page},
        )


    async def get_upcoming(self, page: int = 1) -> dict:
        return await self._cached_get(
            key=f"tmdb:upcoming:{page}",
            endpoint="/movie/upcoming",
            ttl=TTL.UPCOMING,
            params={"page": page},
        )


    async def get_new(self, page: int = 1) -> dict:
        params = {
            "sort_by": "release_date.desc",
            "page": page,
            "release_date.lte": date.today().isoformat()
        }
        return await self._cached_get(
            key=f"tmdb:new:{page}:{date.today().isoformat()}",
            endpoint="/discover/movie",
            ttl=TTL.NEW,
            params=params,
        )


    async def get_trending(self, period: str = "week", page: int = 1) -> dict:
        return await self._cached_get(
            key=f"tmdb:trending:{period}:{page}",
            endpoint=f"/trending/movie/{period}",
            ttl=TTL.TRENDING,
            params={"page": page},
        )


    async def discover(
            self,
            sort_by: str = "popularity.desc",
            genre_id: int | None = None,
            year: int | None = None,
            year_from: int | None = None,
            year_to: int | None = None,
            upcoming: bool = False,
            runtime_min: int | None = None,
            runtime_max: int | None = None,
            page: int = 1
    ) -> dict:
        vote_min = 500 if "vote_average" in sort_by else 100
        params = {
            "sort_by": sort_by,
            "page": page,
            "vote_count.gte": vote_min,
        }
        if genre_id:
            params["with_genres"] = genre_id
        if year:
            params["primary_release_year"] = year
        if year_from:
            params["primary_release_date.gte"] = f"{year_from}-01-01"
        if year_to:
            params["primary_release_date.lte"] = f"{year_to}-12-31"
        if upcoming:
            params["primary_release_date.gte"] = date.today().isoformat()
            params.pop("vote_count.gte", None)
        if runtime_min:
            params["with_runtime.gte"] = runtime_min
        if runtime_max:
            params["with_runtime.lte"] = runtime_max

        # cache key from all params
        cache_key = "tmdb:discover:" + ":".join(f"{k}={v}" for k, v in sorted(params.items()))
        return await self._cached_get(
            key=cache_key,
            endpoint="/discover/movie",
            ttl=TTL.POPULAR,
            params=params,
        )


    async def search_multi(self, query: str, page: int = 1) -> dict:
        return await self._get("/search/multi", {"query": query, "page": page})


    async def search(self, query: str, page: int = 1) -> dict:
        return await self._get("/search/movie", {"query": query, "page": page})


    async def search_person(self, query: str, page: int = 1) -> dict:
        return await self._get("/search/person", {"query": query, "page": page})


    async def get_genres(self) -> list:
        cached = await redis_cache.get("tmdb:genres")
        if cached is not None:
            return cached
        data = await self._get("/genre/movie/list")
        genres = data.get("genres", [])
        await redis_cache.set("tmdb:genres", genres, TTL.GENRES)
        return genres


    async def get_person(self, tmdb_id: int) -> dict:
        return await self._cached_get(
            key=f"tmdb:person:{tmdb_id}",
            endpoint=f"/person/{tmdb_id}",
            ttl=TTL.FILM,
        )


tmdb_client = TMDBClient()