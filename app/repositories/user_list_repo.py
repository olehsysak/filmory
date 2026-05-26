from sqlalchemy import select, update, func, and_, exists, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from app.models.user_list import UserList
from app.models.user_list_film import UserListFilm
from app.models.user import User
from app.models.film_genre import film_genre
from app.models.film import Film
from app.models.user_film import UserFilm


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
        film_count = (
            select(func.count())
            .where(UserListFilm.list_id == UserList.id)
            .correlate(UserList)
            .scalar_subquery()
        )

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
            "name_desc": UserList.name.desc(),
            "films_desc": film_count.desc(),
            "films_asc": film_count.asc(),
        }
        query = query.order_by(sort_map.get(sort, UserList.updated_at.desc()))

        result = await self.db.execute(query)
        return result.all()


    async def get_public_lists(
        self,
        sort: str = "likes_desc",
        search: str | None = None,
        limit: int = 30,
        offset: int = 0,
    ) -> list[tuple[UserList, User, int]]:
        """Get all public lists with author and film count."""
        # Subquery: count films per list
        film_count = (
            select(func.count())
            .where(UserListFilm.list_id == UserList.id)
            .correlate(UserList)
            .scalar_subquery()
        )

        query = (
            select(UserList, User, film_count.label("film_count"))
            .join(User, User.id == UserList.user_id)
            .where(UserList.is_public.is_(True))
        )

        # Optional search by list name
        if search:
            query = query.where(UserList.name.ilike(f"%{search}%"))

        # Allowed sorting options
        sort_map = {
            "likes_desc":   UserList.likes_count.desc(),
            "views_desc":   UserList.views_count.desc(),
            "newest":       UserList.created_at.desc(),
            "updated_desc": UserList.updated_at.desc(),
            "films_desc":   film_count.desc(),
        }

        query = (
            query
            .order_by(sort_map.get(sort, UserList.likes_count.desc()))
            .limit(limit)
            .offset(offset)
        )

        result = await self.db.execute(query)
        return result.all()


    async def get_liked_lists_for_user(
            self,
            liked_list_ids: list[int],
            sort: str = "liked_desc",
            search: str | None = None,
    ) -> list[tuple]:
        """Get public liked lists by IDs with author and film count, sorted and filtered."""
        if not liked_list_ids:
            return []

        # Count films per list
        film_count = (
            select(func.count())
            .where(UserListFilm.list_id == UserList.id)
            .correlate(UserList)
            .scalar_subquery()
        )

        # Public liked lists with authors and film counts
        query = (
            select(UserList, User, film_count.label("film_count"))
            .join(User, User.id == UserList.user_id)
            .where(
                UserList.id.in_(liked_list_ids),
                UserList.is_public.is_(True),
            )
        )

        if search:
            query = query.where(UserList.name.ilike(f"%{search}%"))

        sort_map = {
            "liked_desc": UserList.updated_at.desc(),
            "liked_asc": UserList.updated_at.asc(),
            "likes_desc": UserList.likes_count.desc(),
            "likes_asc": UserList.likes_count.asc(),
            "views_desc": UserList.views_count.desc(),
            "views_asc": UserList.views_count.asc(),
            "films_desc": film_count.desc(),
            "name_asc": UserList.name.asc(),
        }

        query = query.order_by(sort_map.get(sort, UserList.updated_at.desc()))

        result = await self.db.execute(query)
        return result.all()


    async def increment_views(self, list_id: int) -> None:
        """Atomically increment views_count."""
        await self.db.execute(
            update(UserList)
            .where(UserList.id == list_id)
            .values(views_count=UserList.views_count + 1)
        )
        await self.db.commit()


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
            user_id: int | None = None,
            sort: str = "added_desc",
            genre_id: int | None = None,
            year_from: int | None = None,
            year_to: int | None = None,
            upcoming: bool = False,
            runtime_min: int | None = None,
            runtime_max: int | None = None,
            search: str | None = None,
            rated_only: bool = False,
            unrated_only: bool = False,
    ) -> list[UserListFilm]:
        """Get films from a user list with filtering, sorting and optional user-specific data."""
        # Base query: films inside a list
        query = (
            select(UserListFilm)
            .join(Film, Film.id == UserListFilm.film_id)
            .options(joinedload(UserListFilm.film))
            .where(UserListFilm.list_id == list_id)
        )

        # Determine if we need UserFilm join (only for user-specific sorting/filtering)
        needs_user_film = user_id and (
                sort in ("user_rating_desc", "user_rating_asc")
                or rated_only or unrated_only
        )

        if needs_user_film:
            # Join user-specific film data (ratings, etc.)
            query = query.outerjoin(
                UserFilm,
                and_(UserFilm.user_id == user_id, UserFilm.film_id == Film.id)
            )

            if rated_only:
                query = query.where(UserFilm.rating.isnot(None))

            if unrated_only:
                query = query.where(UserFilm.rating.is_(None))

        if genre_id:
            query = query.join(
                film_genre, film_genre.c.film_id == Film.id
            ).where(film_genre.c.genre_id == genre_id)

        if upcoming:
            from datetime import date
            query = query.where(Film.release_date > date.today())
        else:
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
            "release_desc": Film.release_date.desc(),
            "release_asc": Film.release_date.asc(),
            "rating_desc": Film.vote_average.desc(),
            "rating_asc": Film.vote_average.asc(),
            "popularity_desc": Film.popularity.desc(),
            "runtime_desc": Film.runtime.desc(),
            "runtime_asc": Film.runtime.asc(),
            "user_rating_desc": UserFilm.rating.desc().nulls_last(),
            "user_rating_asc": UserFilm.rating.asc().nulls_last(),
        }

        query = query.order_by(
            sort_map.get(sort, UserListFilm.added_at.desc())
        )

        result = await self.db.execute(query)
        return list(result.scalars().unique().all())


    async def add_film(self, list_id: int, film_id: int) -> UserListFilm:
        """Add film to list, auto-assign next position."""
        result = await self.db.execute(
            select(func.max(UserListFilm.position))
            .where(UserListFilm.list_id == list_id)
        )
        max_pos = result.scalar() or 0

        entry = UserListFilm(
            list_id=list_id,
            film_id=film_id,
            position=max_pos + 1,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry


    async def remove_film(self, entry: UserListFilm) -> None:
        """Remove film from list."""
        await self.db.delete(entry)


    async def refresh_cover_poster_paths(self, user_list: UserList) -> None:
        """Recalculate cover_poster_paths and cover_film_ids from first 5 films by position."""
        result = await self.db.execute(
            select(Film.id, Film.poster_path)
            .join(UserListFilm, UserListFilm.film_id == Film.id)
            .where(UserListFilm.list_id == user_list.id)
            .order_by(UserListFilm.position)
            .limit(5)
        )
        rows = [(row[0], row[1]) for row in result.all()]

        user_list.cover_film_ids = [r[0] for r in rows]
        user_list.cover_poster_paths = [r[1] for r in rows if r[1]]


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