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


    async def search(self, query: str, limit: int = 20, page: int = 1) -> list:
        """Search films via TMDB (for relevance ordering), cache results in DB."""
        tmdb_data = await tmdb_client.search(query, page=page)
        films = []

        for item in tmdb_data.get("results", []):
            if len(films) >= limit:
                break

            tmdb_id = item["id"]
            film = await self.film_repo.get_by_tmdb_id(tmdb_id)
            if not film:
                film_data = self._parse_film_data(item)
                film = await self.film_repo.create(film_data)
                await self._attach_genres_from_ids(film, item.get("genre_ids", []))

            films.append(film)

        await self.db.commit()
        return self._set_poster_urls(films)


    async def get_popular(self) -> list:
        """# Fetches popular movies from TMDB and returns synced local movie objects"""
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


    async def get_similar(self, tmdb_id: int) -> list:
        """Get similar films from TMDB and sync to DB."""
        tmdb_data = await tmdb_client.get_similar(tmdb_id)
        return await self._get_or_create_from_tmdb_list(tmdb_data.get("results", []))


    def _set_poster_urls(self, films: list) -> list:
        """Set poster_url for list of films."""
        for film in films:
            film.poster_url = tmdb_client.get_image_url(film.poster_path)
        return films


    async def get_by_genre(self, genre_id: int) -> list:
        """Get films by genre."""
        films = await self.film_repo.get_by_genre(genre_id)
        return self._set_poster_urls(films)


    async def get_catalog(
            self,
            sort: str = "popular",
            genre_id: int | None = None,
            year: int | None = None,
            year_from: int | None = None,
            year_to: int | None = None,
            upcoming: bool = False,
            trending_period: str | None = None,
            runtime_min: int | None = None,
            runtime_max: int | None = None,
            page: int = 1,
    ) -> tuple[list, int, int]:
        """Fetches films catalog from TMDB with optional filters, sorting, and pagination"""

        # Handle trending movies without additional filters using TMDB trending endpoint.
        if trending_period in ("day", "week") and not genre_id and not runtime_min and not runtime_max:
            tmdb_data = await tmdb_client.get_trending(period=trending_period, page=page)
            films = await self._get_or_create_from_tmdb_list(tmdb_data.get("results", []))
            return films, tmdb_data.get("total_results", 0), tmdb_data.get("total_pages", 1)

        # Handle trending movies with additional filters using TMDB discover endpoint.
        if trending_period in ("day", "week"):
            tmdb_data = await tmdb_client.discover(
                sort_by="popularity.desc",
                genre_id=genre_id,
                runtime_min=runtime_min,
                runtime_max=runtime_max,
                page=page,
            )
            films = await self._get_or_create_from_tmdb_list(tmdb_data.get("results", []))
            return films, tmdb_data.get("total_results", 0), tmdb_data.get("total_pages", 1)

        # Optimize default popular request by using a dedicated TMDB popular endpoint.
        if sort == "popular" and not genre_id and not year and not year_from and not runtime_min and not runtime_max and not upcoming:
            tmdb_data = await tmdb_client.get_popular(page=page)
            films = await self._get_or_create_from_tmdb_list(tmdb_data.get("results", []))
            return films, tmdb_data.get("total_results", 0), tmdb_data.get("total_pages", 1)

        # Map sorting options to TMDB-compatible sort parameters.
        sort_map = {
            "popular": "popularity.desc",
            "top_rated": "vote_average.desc",
            "lowest_rated": "vote_average.asc",
            "newest": "release_date.desc",
            "oldest": "release_date.asc",
        }
        sort_by = sort_map.get(sort, "popularity.desc")

        # Fetch filtered film catalog using TMDB discover endpoint.
        tmdb_data = await tmdb_client.discover(
            sort_by=sort_by,
            genre_id=genre_id,
            year=year,
            year_from=year_from,
            year_to=year_to,
            upcoming=upcoming,
            runtime_min=runtime_min,
            runtime_max=runtime_max,
            page=page,
        )
        films = await self._get_or_create_from_tmdb_list(tmdb_data.get("results", []))

        return films, tmdb_data.get("total_results", 0), tmdb_data.get("total_pages", 1)


    async def get_film_stats(self, film_id: int) -> dict:
        """Returns status counts, percentages and Filmory rating for a film."""
        row = await self.film_repo.get_stats(film_id)
        total = row.total or 1

        def fmt_count(n: int) -> str | None:
            if not n:
                return None
            if n >= 1000:
                return f"{n / 1000:.1f}k"
            return str(n)

        return {
            "filmory_rating": float(row.filmory_rating) if row.filmory_rating else None,
            "filmory_votes": row.filmory_votes or 0,
            "status_counts": {
                "want_to_watch": fmt_count(row.want_to_watch),
                "watching": fmt_count(row.watching),
                "completed": fmt_count(row.completed),
                "dropped": fmt_count(row.dropped),
            },
            "status_pcts": {
                "want_to_watch": round((row.want_to_watch or 0) / total * 100),
                "watching": round((row.watching or 0) / total * 100),
                "completed": round((row.completed or 0) / total * 100),
                "dropped": round((row.dropped or 0) / total * 100),
            } if row.total else {},
        }


    async def get_film_public_lists(self, film_id: int) -> list[dict]:
        """Public lists containing this film."""
        rows = await self.film_repo.get_public_lists(film_id)
        return [
            {
                "id": ul.id,
                "name": ul.name,
                "username": user.username,
                "film_count": film_count,
                "cover_url": (
                    tmdb_client.get_image_url(ul.cover_poster_paths[0], size="w92")
                    if ul.cover_poster_paths else None
                ),
            }
            for ul, user, film_count in rows
        ]