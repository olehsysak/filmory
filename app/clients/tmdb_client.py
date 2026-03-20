import httpx
from app.config import TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_URL


class TMDBClient:
    """Client for TMDB API"""

    def __init__(self):
        self.base_url = TMDB_BASE_URL
        self.api_key = TMDB_API_KEY
        self.image_url = TMDB_IMAGE_URL


    async def _get(self, endpoint: str, params: dict = None) -> dict:
        """Base GET request to TMDB API"""
        if params is None:
            params = {}
        params['api_key'] = self.api_key

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            return response.json()


    async def get_popular(self, page: int = 1) -> dict:
        """Get popular films."""
        return await self._get("/movie/popular", {"page": page})


    async def get_top_rated(self, page: int = 1) -> dict:
        """Get top rated films."""
        return await self._get("/movie/top_rated", {"page": page})


    async def get_film(self, tmdb_id: int) -> dict:
        """Get film details by ID."""
        return await self._get(f"/movie/{tmdb_id}")


    async def get_similar(self, tmdb_id: int) -> dict:
        """Get similar films."""
        return await self._get(f"/movie/{tmdb_id}/similar")


    async def search(self, query: str, page: int = 1) -> dict:
        """Search films by title."""
        return await self._get("/search/movie", {"query": query, "page": page})


    async def get_by_genre(self, genre_id: int, page: int = 1) -> dict:
        """Get films by genre."""
        return await self._get("/discover/movie", {"with_genres": genre_id, "page": page})


    async def get_genres(self) -> dict:
        """Get all genres."""
        return await self._get("/genre/movie/list")


    def get_image_url(self, poster_path: str | None) -> str | None:
        """Get full image URL from poster path."""
        if not poster_path:
            return None
        return f"{self.image_url}{poster_path}"


tmdb_client = TMDBClient()