from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_favorite_repo import UserFavoriteRepository
from app.repositories.film_repo import FilmRepository
from app.models.user_favorite import UserFavorite
from app.schemas.user_favorite import UserFavoriteResponse
from app.schemas.film import FilmShort
from app.clients.tmdb_client import tmdb_client
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


    async def get_state(self, user_id: int, tmdb_id: int) -> bool:
        """Check if film is in favorites — returns True/False."""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            return False
        entry = await self.repo.get(user_id, film.id)
        return entry is not None


    async def get_all(self, user_id: int, **filters) -> list[UserFavoriteResponse]:
        """Get all user favorite films with filters and DTO mapping."""
        rows = await self.repo.get_all(user_id, **filters)
        result = []

        for favorite, rating, status in rows:
            favorite.film.poster_url = tmdb_client.get_image_url(favorite.film.poster_path)
            result.append(UserFavoriteResponse(
                id=favorite.id,
                film=FilmShort.model_validate(favorite.film),
                added_at=favorite.added_at,
                rating=rating,
                status=status,
            ))

        return result