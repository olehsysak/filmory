from sqlalchemy import select, func, and_, exists, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from app.models.user_list import UserList
from app.models.user_list_film import UserListFilm
from app.models.film_genre import film_genre
from app.models.film import Film


class UserListRepository:
    """Repository for user list operations."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_by_id(self, list_id: int) -> UserList | None:
        """Get list by ID with cover film loaded."""
        result = await self.db.execute(
            select(UserList)
            .options(joinedload(UserList.cover_film))
            .where(UserList.id == list_id)
        )
        return result.scalar_one_or_none()


    async def get_all_for_user(
        self,
        user_id: int,
        sort: str = "updated_desc",
        is_public: bool | None = None,
        search: str | None = None,
    ) -> list[tuple[UserList, int]]:
        """Get all user lists with film count. Returns (UserList, film_count) tuples."""
        # Subquery that counts how many films are in each list
        film_count = (
            select(func.count())
            .where(UserListFilm.list_id == UserList.id)
            .correlate(UserList)
            .scalar_subquery()
        )

        # fetch lists + computed film_count
        query = (
            select(UserList, film_count.label("film_count"))
            .options(joinedload(UserList.cover_film))
            .where(UserList.user_id == user_id)
        )

        if is_public is not None:
            query = query.where(UserList.is_public == is_public)
        if search:
            query = query.where(UserList.name.ilike(f"%{search}%"))

        sort_map = {
            "updated_desc": UserList.updated_at.desc(),
            "updated_asc": UserList.updated_at.asc(),
            "created_desc": UserList.created_at.desc(),
            "created_asc": UserList.created_at.asc(),
            "name_asc": UserList.name.asc(),
            "films_desc": film_count.desc(),
        }
        query = query.order_by(sort_map.get(sort, UserList.updated_at.desc()))

        result = await self.db.execute(query)
        return result.all()


    async def create(self, user_id: int, name: str, description: str | None, is_public: bool) -> UserList:
        """Create a new user list."""
        entry = UserList(
            user_id=user_id,
            name=name,
            description=description,
            is_public=is_public,
        )
        self.db.add(entry)
        return entry


    async def delete(self, entry: UserList) -> None:
        """Delete a user list (cascades to list films)."""
        await self.db.delete(entry)


    async def get_list_film(self, list_id: int, film_id: int) -> UserListFilm | None:
        """Get a single list-film record."""
        result = await self.db.execute(
            select(UserListFilm).where(
                and_(UserListFilm.list_id == list_id, UserListFilm.film_id == film_id)
            )
        )
        return result.scalar_one_or_none()


    async def get_films(
        self,
        list_id: int,
        sort: str = "added_desc",
        genre_id: int | None = None,
        year_from: int | None = None,
        year_to: int | None = None,
        runtime_min: int | None = None,
        runtime_max: int | None = None,
        search: str | None = None,
    ) -> list[UserListFilm]:
        """Get all films in a list with optional filters."""
        # Select association rows (UserListFilm) and join Film for filtering + sorting
        query = (
            select(UserListFilm)
            .join(Film, Film.id == UserListFilm.film_id)
            .options(joinedload(UserListFilm.film))
            .where(UserListFilm.list_id == list_id)
        )

        # Filters — the same as in the collection, but without rated_only *
        if genre_id:
            query = query.join(
                film_genre, film_genre.c.film_id == Film.id
            ).where(film_genre.c.genre_id == genre_id)
        if year_from:
            query = query.where(extract("year", Film.release_date) >= year_from)
        if year_to:
            query = query.where(extract("year", Film.release_date) <= year_to)
        if runtime_min:
            query = query.where(Film.runtime >= runtime_min)
        if runtime_max:
            query = query.where(Film.runtime <= runtime_max)
        if search:
            query = query.where(Film.title.ilike(f"%{search}%"))

        sort_map = {
            "added_desc": UserListFilm.added_at.desc(),
            "added_asc": UserListFilm.added_at.asc(),
            "position": UserListFilm.position.asc(),
            "release_desc": Film.release_date.desc(),
            "release_asc": Film.release_date.asc(),
            "rating_desc": Film.vote_average.desc(),
            "title_asc": Film.title.asc(),
        }
        query = query.order_by(sort_map.get(sort, UserListFilm.added_at.desc()))

        result = await self.db.execute(query)
        return list(result.scalars().unique().all())


    async def add_film(self, list_id: int, film_id: int) -> UserListFilm:
        """Add film to list with auto-incremented position."""
        max_pos_result = await self.db.execute(
            select(func.coalesce(func.max(UserListFilm.position), 0))
            .where(UserListFilm.list_id == list_id)
        )
        next_position = max_pos_result.scalar_one() + 1

        entry = UserListFilm(list_id=list_id, film_id=film_id, position=next_position)
        self.db.add(entry)
        return entry


    async def remove_film(self, entry: UserListFilm) -> None:
        """Remove film from list."""
        await self.db.delete(entry)


    async def get_lists_for_film(self, user_id: int, film_id: int) -> list[UserList]:
        """Get all user lists that contain a specific film (for modal checkbox state)."""
        result = await self.db.execute(
            select(UserList)
            .where(UserList.user_id == user_id)
            .where(
                exists(
                    select(UserListFilm.id).where(
                        and_(
                            UserListFilm.list_id == UserList.id,
                            UserListFilm.film_id == film_id,
                        )
                    )
                )
            )
            .order_by(UserList.updated_at.desc())
        )
        return list(result.scalars().all())