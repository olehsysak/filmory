from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from app.models.user_favorite import UserFavorite
from app.models.user_film import UserFilm
from app.models.film import Film
from app.repositories.filters import apply_film_filters, apply_sort


class UserFavoriteRepository:
    """Repository for user favorites operations"""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get(self, user_id: int, film_id: int) -> UserFavorite | None:
        """Get a single favorite record by user and film IDs."""
        result = await self.db.execute(
            select(UserFavorite)
            .options(joinedload(UserFavorite.film))
            .where(and_(UserFavorite.user_id == user_id, UserFavorite.film_id == film_id))
        )
        return result.scalar_one_or_none()


    async def get_all(
            self,
            user_id: int,
            sort: str = "added_desc",
            genre_id: int | None = None,
            year: int | None = None,
            year_from: int | None = None,
            year_to: int | None = None,
            upcoming: bool = False,
            runtime_min: int | None = None,
            runtime_max: int | None = None,
            rated_only: bool = False,
            unrated_only: bool = False,
            search: str | None = None,
    ):
        """Get all user favorites with optional filters and sorting."""
        query = (
            select(UserFavorite, UserFilm.rating, UserFilm.status)
            .join(Film, Film.id == UserFavorite.film_id)
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

        query = apply_film_filters(
            query, Film,
            genre_id=genre_id, year=year, year_from=year_from, year_to=year_to,
            upcoming=upcoming,
            runtime_min=runtime_min, runtime_max=runtime_max,
            rated_only=rated_only, unrated_only=unrated_only, search=search,
            is_favorite=True,
        )

        query = apply_sort(query, UserFavorite, Film, sort, is_favorite=True)
        result = await self.db.execute(query)
        return result.all()


    async def create(self, user_id: int, film_id: int) -> UserFavorite:
        """Add film to user favorites."""
        entry = UserFavorite(user_id=user_id, film_id=film_id)
        self.db.add(entry)
        return entry


    async def delete(self, entry: UserFavorite) -> None:
        """Remove a film from user favorites."""
        await self.db.delete(entry)