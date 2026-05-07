from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from app.models.user_film import UserFilm, WatchStatus


class UserFilmRepository:
    """Repository for user films"""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get(self, user_id: int, film_id: int) -> UserFilm | None:
        """Get a specific UserFilm entry by user and film IDs."""
        result = await self.db.execute(
            select(UserFilm)
            .options(joinedload(UserFilm.film))
            .where(and_(UserFilm.user_id == user_id, UserFilm.film_id == film_id))
        )
        return result.scalar_one_or_none()


    async def get_by_status(self, user_id: int, status: WatchStatus) -> list[UserFilm]:
        """Get all UserFilm entries for a user with a specific watch status."""
        result = await self.db.execute(
            select(UserFilm)
            .options(joinedload(UserFilm.film))
            .where(and_(UserFilm.user_id == user_id, UserFilm.status == status))
        )
        return list(result.scalars().all())


    async def create(self, user_id: int, film_id: int, status: WatchStatus) -> UserFilm:
        """Create a new UserFilm entry."""
        entry = UserFilm(user_id=user_id, film_id=film_id, status=status)
        self.db.add(entry)
        return entry


    async def delete(self, entry: UserFilm) -> None:
        """Delete a UserFilm entry from the database."""
        await self.db.delete(entry)