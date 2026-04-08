from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.film_repo import FilmRepository
from app.repositories.genre_repo import GenreRepository
from app.clients.tmdb_client import tmdb_client
from datetime import date


class FilmService:
    """Service for film business logic."""
    def __init__(self, db: AsyncSession):
        self.db = db
        self.film_repo = FilmRepository(db)
        self.genre_repo = GenreRepository(db)


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
            "backdrop_path": tmdb_data.get("backdrop_path"),
            "release_date": release_date,
            "vote_average": tmdb_data.get("vote_average", 0.0),
            "vote_count": tmdb_data.get("vote_count", 0),
            "popularity": tmdb_data.get("popularity", 0.0),
            "runtime": tmdb_data.get("runtime"),
        }


    async def _attach_genres_from_ids(self, film, genre_ids: list) -> None:
        """Attach genres to film using genre_ids (from list endpoints)."""
        existing_ids = {g.tmdb_id for g in film.genres}
        for genre_id in genre_ids:
            if genre_id in existing_ids:
                continue # Skip if genre is already added
            genre = await self.genre_repo.get_by_tmdb_id(genre_id)
            if genre:
                film.genres.append(genre)


    async def _attach_genres_from_objects(self, film, genres: list) -> None:
        """Attach genres to film using full genre objects (from detail endpoint)."""
        existing_ids = {g.tmdb_id for g in film.genres}
        for genre_data in genres:
            if genre_data["id"] in existing_ids:
                continue # Skip already attached genres
            genre = await self.genre_repo.get_or_create(
                tmdb_id=genre_data["id"],
                name=genre_data["name"]
            )
            film.genres.append(genre)


    async def get_or_fetch_film(self, tmdb_id: int):
        """Get film from DB or fetch from TMDB and save/update."""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)

        # Return if film exists and has complete details
        if film and film.runtime is not None and film.tagline is not None and film.genres:
            film.poster_url = tmdb_client.get_image_url(film.poster_path)
            film.backdrop_url = tmdb_client.get_image_url(film.backdrop_path, size="w1280") if film.backdrop_path else None
            return film

        # Fetch film data from TMDB
        tmdb_data = await tmdb_client.get_film(tmdb_id)
        film_data = self._parse_film_data(tmdb_data)

        if film:
            # Update only missing fields in existing film
            for key, value in film_data.items():
                if getattr(film, key) is None and value is not None:
                    setattr(film, key, value)
        else:
            film = await self.film_repo.create(film_data)

        # Attach full genre objects from TMDB detail
        await self._attach_genres_from_objects(film, tmdb_data.get("genres", []))
        await self.db.commit()
        await self.db.refresh(film)
        film.poster_url = tmdb_client.get_image_url(film.poster_path)
        film.backdrop_url = tmdb_client.get_image_url(film.backdrop_path, size="w1280") if film.backdrop_path else None
        return film


    async def _get_or_create_from_tmdb_list(self, items: list) -> list:
        films = []
        for item in items:
            film = await self.film_repo.get_by_tmdb_id(item["id"])
            if not film:
                film_data = self._parse_film_data(item)
                film = await self.film_repo.create(film_data)
            await self._attach_genres_from_ids(film, item.get("genre_ids", []))
            films.append(film)
        await self.db.commit()
        return self._set_poster_urls(films)


    async def search(self, query: str) -> list:
        """Search films in DB first, then TMDB (with merge)."""
        db_films = await self.film_repo.search(query)
        if len(db_films) >= 10:
            return self._set_poster_urls(db_films)

        # Fetch from TMDB if not enough DB results
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

            await self._attach_genres_from_ids(film, item.get("genre_ids", []))
            films.append(film)
            existing_tmdb_ids.add(tmdb_id)

        await self.db.commit()
        return self._set_poster_urls(films)


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


    def _set_poster_urls(self, films: list) -> list:
        """Set poster_url for list of films."""
        for film in films:
            film.poster_url = tmdb_client.get_image_url(film.poster_path)
        return films


    async def get_by_genre(self, genre_id: int) -> list:
        """Get films by genre."""
        films = await self.film_repo.get_by_genre(genre_id)
        return self._set_poster_urls(films)