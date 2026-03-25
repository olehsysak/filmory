from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.film_repo import FilmRepository
from app.clients.tmdb_client import tmdb_client
from datetime import date


class FilmService:
    """Service for film business logic."""
    def __init__(self, db: AsyncSession):
        self.db = db
        self.film_repo = FilmRepository(db)


    def _parse_film_data(self, tmdb_data: dict) -> dict:
        """Parse TMDB film data to our database format."""
        release_date = None
        raw_date = tmdb_data.get("release_date")
        if raw_date:
            try:
                release_date = date.fromisoformat(raw_date)
            except ValueError:
                release_date = None

        return {
            "tmdb_id": tmdb_data.get("id"),
            "title": tmdb_data.get("title", ""),
            "overview": tmdb_data.get("overview"),
            "tagline": tmdb_data.get("tagline"),
            "poster_path": tmdb_data.get("poster_path"),
            "release_date": release_date,
            "vote_average": tmdb_data.get("vote_average", 0.0),
            "vote_count": tmdb_data.get("vote_count", 0),
            "popularity": tmdb_data.get("popularity", 0.0),
            "runtime": tmdb_data.get("runtime"),
        }


    async def get_or_fetch_film(self, tmdb_id: int):
        """Get film from DB or fetch from TMDB and save/update."""
        # Try to get film from database
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)

        # If film exists and has full details, return it with poster_url
        if film and film.runtime is not None and film.tagline is not None:
            film.poster_url = tmdb_client.get_image_url(film.poster_path)
            return film

        # Fetch full film data from TMDB
        tmdb_data = await tmdb_client.get_film(tmdb_id)
        film_data = self._parse_film_data(tmdb_data)

        if film:
            # Update only missing fields in existing film
            for key, value in film_data.items():
                if getattr(film, key) is None and value is not None:
                    setattr(film, key, value)

            await self.db.commit()
            await self.db.refresh(film)
            film.poster_url = tmdb_client.get_image_url(film.poster_path)
            return film

        # If film does not exist, create a new DB record
        film = await self.film_repo.create(film_data)
        film.poster_url = tmdb_client.get_image_url(film.poster_path)
        return film


    async def search(self, query: str) -> list:
        """Search films in DB first, then TMDB (with merge)."""
        db_films = await self.film_repo.search(query)
        if len(db_films) >= 10:
            return db_films

        # If less than 10 results, fetch from TMDB
        tmdb_data = await tmdb_client.search(query)
        films = db_films.copy()
        existing_tmdb_ids = {film.tmdb_id for film in films}

        for item in tmdb_data.get("results", []):
            tmdb_id = item["id"]
            if tmdb_id in existing_tmdb_ids:
                continue

            film = await self.film_repo.get_by_tmdb_id(tmdb_id)

            if not film:
                film_data = self._parse_film_data(item)
                film = await self.film_repo.create(film_data)

            films.append(film)
            existing_tmdb_ids.add(tmdb_id)

        return films


    async def _get_or_create_from_tmdb_list(self, items: list) -> list:
        """Get films from DB or create them from TMDB data list."""
        films = []
        for item in items:
            film = await self.film_repo.get_by_tmdb_id(item["id"])
            if not film:
                film_data = self._parse_film_data(item)
                film = await self.film_repo.create(film_data)
            films.append(film)
        return films


    async def get_popular(self) -> list:
        """Get popular films from TMDB and sync with DB."""
        tmdb_data = await tmdb_client.get_popular()
        return await self._get_or_create_from_tmdb_list(
            tmdb_data.get("results", [])
        )


    async def get_top_rated(self) -> list:
        """Get top rated films from TMDB and sync with DB."""
        tmdb_data = await tmdb_client.get_top_rated()
        return await self._get_or_create_from_tmdb_list(
            tmdb_data.get("results", [])
        )


    async def get_top_upcoming(self) -> list:
        """Get upcoming films from TMDB and sync with DB."""
        tmdb_data = await tmdb_client.get_upcoming()
        return await self._get_or_create_from_tmdb_list(
            tmdb_data.get("results", [])
        )


    async def get_new(self) -> list:
        """Get new films sorted by release date descending and sync with DB."""
        tmdb_data = await tmdb_client.get_new()
        return await self._get_or_create_from_tmdb_list(
            tmdb_data.get("results", [])
        )