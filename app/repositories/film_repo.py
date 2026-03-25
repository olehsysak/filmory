from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Film
from datetime import date


class FilmRepository:
    """Repository for films operations."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_by_id(self, film_id: int) -> Film | None:
        """Get film by internal ID."""
        result = await self.db.scalar(select(Film).where(Film.id == film_id))
        return result


    async def get_by_tmdb_id(self, tmdb_id: int) -> Film | None:
        """Get film by TMDB ID."""
        result = await self.db.scalar(select(Film).where(Film.tmdb_id == tmdb_id))
        return result


    async def create(self, film_data: dict) -> Film:
        """Create new film in database."""
        film = Film(**film_data)
        self.db.add(film)
        await self.db.commit()
        await self.db.refresh(film)
        return film


    async def get_popular(self, limit: int = 20) -> list[Film]:
        """Get popular films ordered by popularity."""
        result = await self.db.scalars(
            select(Film)
            .order_by(Film.popularity.desc())
            .limit(limit)
        )
        return list(result.all())


    async def get_top_rated(self, limit: int = 20) -> list[Film]:
        """Get top rated films ordered by vote average."""
        result = await self.db.scalars(
            select(Film)
            .where(Film.vote_count > 100)
            .order_by(Film.vote_average.desc())
            .limit(limit)
        )
        return list(result.all())


    async def search(self, query: str, limit: int = 20) -> list[Film]:
        """Search films by title."""
        result = await self.db.scalars(
            select(Film)
            .where(Film.title.ilike(f"%{query}%"))
            .limit(limit)
        )
        return list(result.all())


    async def get_upcoming(self, limit: int = 20) -> list[Film]:
        """Get upcoming films."""
        today = date.today()
        result = await self.db.scalars(
            select(Film)
            .where(Film.release_date > today)
            .order_by(Film.release_date.asc())
            .limit(limit)
        )
        return list(result.all())


    async def get_new(self, limit: int = 20) -> list[Film]:
        """Get new films."""
        result = await self.db.scalars(
            select(Film)
            .order_by(Film.release_date.desc())
            .limit(limit)
        )
        return list(result.all())