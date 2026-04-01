from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.genre_repo import GenreRepository


class GenreService:
    """Service for genre business logic."""
    def __init__(self, db: AsyncSession):
        self.db = db
        self.genre_repo = GenreRepository(db)

    async def get_all(self) -> list:
        return await self.genre_repo.get_all()