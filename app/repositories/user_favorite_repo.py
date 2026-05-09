from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from app.models.user_favorite import UserFavorite
from app.models.user_film import UserFilm


class UserFavoriteRepository:
    """Repository for user favorites operations"""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get(self, user_id: int, film_id: int) -> UserFavorite | None:
        """Get favorite entry by user and film ids"""
        result = await self.db.execute(
            select(UserFavorite)
            .options(joinedload(UserFavorite.film))
            .where(and_(UserFavorite.user_id == user_id, UserFavorite.film_id == film_id))
        )
        return result.scalar_one_or_none()


    async def get_all(self, user_id: int) -> list[dict]:
        result = await self.db.execute(
            select(
                UserFavorite,
                UserFilm.rating,
                UserFilm.status,
            )
            .options(joinedload(UserFavorite.film))
            .outerjoin(
                UserFilm,
                and_(
                    UserFilm.user_id == UserFavorite.user_id,
                    UserFilm.film_id == UserFavorite.film_id,
                )
            )
            .where(UserFavorite.user_id == user_id)
        )
        return result.all()


    async def create(self, user_id: int, film_id: int) -> UserFavorite:
        """Create a new favorite entry"""
        entry = UserFavorite(user_id=user_id, film_id=film_id)
        self.db.add(entry)
        return entry


    async def delete(self, entry: UserFavorite) -> None:
        """Delete favorite entry"""
        await self.db.delete(entry)