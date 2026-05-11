from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from app.models.user_film import UserFilm, WatchStatus
from app.models.film import Film
from app.repositories.filters import apply_film_filters, apply_sort


class UserFilmRepository:
    """Repository for user films operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id: int, film_id: int) -> UserFilm | None:
        """Get a single user-film relation by user and film IDs"""
        result = await self.db.execute(
            select(UserFilm)
            .options(joinedload(UserFilm.film))
            .where(and_(UserFilm.user_id == user_id, UserFilm.film_id == film_id))
        )
        return result.scalar_one_or_none()


    async def get_by_status(
            self,
            user_id: int,
            status: WatchStatus,
            sort: str = "added_desc",
            genre_id: int | None = None,
            year: int | None = None,
            year_from: int | None = None,
            year_to: int | None = None,
            runtime_min: int | None = None,
            runtime_max: int | None = None,
            rated_only: bool = False,
            unrated_only: bool = False,
            search: str | None = None,
    ) -> list[UserFilm]:
        """Get all user films by status with filters and sorting."""
        # Base query for user films with film relation and status filtering
        query = (
            select(UserFilm)
            .join(Film, Film.id == UserFilm.film_id)
            .options(joinedload(UserFilm.film))
            .where(and_(UserFilm.user_id == user_id, UserFilm.status == status))
        )

        # Apply filtering rules (genre, year, runtime, rating, search)
        query = apply_film_filters(
            query, Film,
            genre_id=genre_id, year=year, year_from=year_from, year_to=year_to,
            runtime_min=runtime_min, runtime_max=runtime_max,
            rated_only=rated_only, unrated_only=unrated_only, search=search,
        )

        query = apply_sort(query, UserFilm, Film, sort)
        result = await self.db.execute(query)

        return list(result.scalars().unique().all())


    async def create(self, user_id: int, film_id: int, status: WatchStatus) -> UserFilm:
        """Create a new user-film relation."""
        entry = UserFilm(user_id=user_id, film_id=film_id, status=status)
        self.db.add(entry)
        return entry


    async def delete(self, entry: UserFilm) -> None:
        """Delete a user-film relation"""
        await self.db.delete(entry)