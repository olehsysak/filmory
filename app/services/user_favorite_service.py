from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Film
from app.repositories.user_favorite_repo import UserFavoriteRepository
from app.repositories.film_repo import FilmRepository
from app.models.user_favorite import UserFavorite
from app.clients.tmdb_client import TMDBClient, tmdb_client
from fastapi import status, HTTPException


class UserFavoriteService:
    """Service for user favorite films."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserFavoriteRepository(db)
        self.film_repo = FilmRepository(db)


    async def add(self, user_id: int, tmdb_id: int) -> UserFavorite:
        """Add film to user favorite"""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        existing = await self.repo.get(user_id, film.id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Film already in favorites")

        await self.repo.create(user_id, film.id)
        await self.db.commit()
        return await self.repo.get(user_id, film.id)


    async def remove(self, user_id: int, tmdb_id: int) -> None:
        """Remove film from user favorite"""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        entry = await self.repo.get(user_id, film.id)
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not in favorites")

        await self.repo.delete(entry)
        await self.db.commit()


    async def get_all(self, user_id: int) -> list[UserFavorite]:
        """Get all user favorites"""
        entries = await self.repo.get_all(user_id)
        for e in entries:
            e.film.poster_url = tmdb_client.get_image_url(e.film.poster_path)
        return entries