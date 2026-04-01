from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Film
from app.models import Genre
from datetime import date


class FilmRepository:
    """Repository for films operations."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_by_id(self, film_id: int) -> Film | None:
        """Get film by internal ID."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .where(Film.id == film_id)
        )
        return result.scalar_one_or_none()


    async def get_by_tmdb_id(self, tmdb_id: int) -> Film | None:
        """Get film by TMDB ID."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .where(Film.tmdb_id == tmdb_id)
        )
        return result.scalar_one_or_none()


    async def create(self, film_data: dict) -> Film:
        """Create new film in database."""
        film = Film(**film_data)
        film.genres = []
        self.db.add(film)
        await self.db.flush()
        return film


    async def search(self, query: str, limit: int = 20) -> list[Film]:
        """Search films by title."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .where(Film.title.ilike(f"%{query}%"))
            .limit(limit)
        )
        return list(result.scalars().all())


    async def get_popular(self, limit: int = 20) -> list[Film]:
        """Get popular films ordered by popularity."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .order_by(Film.popularity.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


    async def get_top_rated(self, limit: int = 20) -> list[Film]:
        """Get top rated films ordered by vote average."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .where(Film.vote_count > 100)
            .order_by(Film.vote_average.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


    async def get_upcoming(self, limit: int = 20) -> list[Film]:
        """Get upcoming films."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .where(Film.release_date > date.today())
            .order_by(Film.release_date.asc())
            .limit(limit)
        )
        return list(result.scalars().all())


    async def get_new(self, limit: int = 20) -> list[Film]:
        """Get new films."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .order_by(Film.release_date.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


    async def get_by_genre(self, genre_id: int, limit: int = 20) -> list[Film]:
        """Get films by genre internal ID."""
        result = await self.db.execute(
            select(Film)
            .options(selectinload(Film.genres))
            .join(Film.genres)
            .where(Genre.id == genre_id)
            .limit(limit)
        )
        return list(result.scalars().all())