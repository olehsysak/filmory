import httpx
from app.config import TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_URL
from datetime import date

class TMDBClient:
    """Client for TMDB API"""

    def __init__(self):
        self.base_url = TMDB_BASE_URL
        self.api_key = TMDB_API_KEY
        self.image_url = TMDB_IMAGE_URL


    async def _get(self, endpoint: str, params: dict = None) -> dict:
        """Base GET request to TMDB API."""
        if params is None:
            params = {}
        params['api_key'] = self.api_key

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            return response.json()


    def get_image_url(self, poster_path: str | None, size: str = "w500") -> str | None:
        """Get full image URL from poster path."""
        if not poster_path:
            return None
        return f"https://image.tmdb.org/t/p/{size}{poster_path}"


    async def get_film(self, tmdb_id: int) -> dict:
        """Get film details by ID."""
        return await self._get(f"/movie/{tmdb_id}")


    async def get_similar(self, tmdb_id: int) -> dict:
        """Get similar films."""
        return await self._get(f"/movie/{tmdb_id}/similar")


    async def get_credits(self, tmdb_id: int) -> dict:
        """Get cast and crew for a film."""
        return await self._get(f"/movie/{tmdb_id}/credits")


    async def get_person_film_credits(self, tmdb_id: int) -> dict:
        """Get all film credits for a person."""
        return await self._get(f"/person/{tmdb_id}/movie_credits")


    async def get_popular(self, page: int = 1) -> dict:
        """Get popular films."""
        return await self._get("/movie/popular", {"page": page})


    async def get_top_rated(self, page: int = 1) -> dict:
        """Get top rated films."""
        return await self._get("/movie/top_rated", {"page": page})


    async def get_upcoming(self, page: int = 1) -> dict:
        """Get upcoming films."""
        return await self._get("/movie/upcoming", {"page": page})


    async def get_new(self, page: int = 1) -> dict:
        """Get new films (sorted by release_date descending)."""
        params = {
            "sort_by": "release_date.desc",
            "page": page,
            "release_date.lte": date.today().isoformat()
        }
        return await self._get("/discover/movie", params)


    async def get_trending(self, period: str = "week", page: int = 1) -> dict:
        """Get trending films. Period: day or week."""
        return await self._get(f"/trending/movie/{period}", {"page": page})


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

        return await self._get("/discover/movie", params)


    async def search(self, query: str, page: int = 1) -> dict:
        """Search films by title."""
        return await self._get("/search/movie", {"query": query, "page": page})


    async def get_genres(self) -> list:
        """Get all movie genres from TMDB."""
        data = await self._get("/genre/movie/list")
        return data.get("genres", [])


    async def get_person(self, tmdb_id: int) -> dict:
        """Get person details by TMDB ID."""
        return await self._get(f"/person/{tmdb_id}")


tmdb_client = TMDBClient()