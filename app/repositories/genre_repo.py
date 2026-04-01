from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.genre import Genre


class GenreRepository:
    """Genre repository."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_by_tmdb_id(self, tmdb_id: int) -> Genre | None:
        """Get genre by TMDB id."""
        result = await self.db.execute(
            select(Genre).where(Genre.tmdb_id == tmdb_id)
        )
        return result.scalar_one_or_none()


    async def create(self, tmdb_id: int, name: str) -> Genre:
        """Create genre by TMDB id."""
        genre = Genre(tmdb_id=tmdb_id, name=name)
        self.db.add(genre)
        await self.db.flush()
        return genre


    async def get_or_create(self, tmdb_id: int, name: str) -> Genre:
        """Get or create genre by TMDB id."""
        genre = await self.get_by_tmdb_id(tmdb_id)
        if not genre:
            genre = await self.create(tmdb_id, name)
        return genre


    async def get_all(self) -> list[Genre]:
        """Get all genres."""
        result = await self.db.execute(select(Genre))
        return list(result.scalars().all())


    async def bulk_create_or_update(self, genres: list[dict]) -> None:
        """Save all genres from TMDB to DB efficiently."""
        result = await self.db.execute(select(Genre))
        existing = {g.tmdb_id: g for g in result.scalars().all()}

        for genre_data in genres:
            tmdb_id = genre_data["id"]
            name = genre_data["name"]

            if tmdb_id in existing:
                existing[tmdb_id].name = name
            else:
                self.db.add(Genre(tmdb_id=tmdb_id, name=name))

        await self.db.flush()