from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.repositories.user_list_repo import UserListRepository
from app.repositories.user_list_like_repo import UserListLikeRepository
from app.repositories.film_repo import FilmRepository
from app.repositories.user_list_view_repo import UserListViewRepository
from app.models.user_list import UserList
from app.models.user_list_film import UserListFilm
from app.models.user_film import UserFilm
from app.models.film import Film
from app.clients.tmdb_client import tmdb_client


class UserListService:
    """Service for user list operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserListRepository(db)
        self.like_repo = UserListLikeRepository(db)
        self.film_repo = FilmRepository(db)
        self.view_repo = UserListViewRepository(db)


    async def create(self, user_id: int, name: str, description: str | None, is_public: bool) -> UserList:
        """Create a new user list."""
        entry = await self.repo.create(user_id, name, description, is_public)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry


    async def get_all(
        self,
        user_id: int,
        sort: str = "updated_desc",
        is_public: bool | None = None,
        search: str | None = None,
    ) -> list[dict]:
        """Get all user lists with film count and cover poster URL."""
        rows = await self.repo.get_all_for_user(user_id, sort=sort, is_public=is_public, search=search)
        return [self._serialize_list(user_list, film_count) for user_list, film_count in rows]


    async def get_detail(self, list_id: int, user_id: int | None) -> dict:
        """Get full list detail. Private lists only for owner."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)

        is_owner = user_id is not None and user_list.user_id == user_id

        if not user_list.is_public and not is_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This list is private")

        # Unique view counting for authenticated non-owners
        if user_list.is_public and user_id and not is_owner:
            already_viewed = await self.view_repo.get(user_id, list_id)
            if not already_viewed:
                await self.view_repo.create(user_id, list_id)
                await self.view_repo.increment_views(list_id)
                await self.db.commit()
                user_list.views_count += 1  # reflect locally without re-fetch

        # Check if current user liked this list
        is_liked = False
        if user_id and not is_owner:
            like = await self.like_repo.get(user_id, list_id)
            is_liked = like is not None

        # Count films
        rows = await self.repo.get_all_for_user(user_list.user_id)
        film_count = next((fc for ul, fc in rows if ul.id == list_id), 0)

        data = self._serialize_list(user_list, film_count)
        data["is_owner"] = is_owner
        data["is_liked"] = is_liked
        return data


    async def get_public(self, list_id: int) -> UserList:
        """Get list by ID — must be public (for public page)."""
        user_list = await self.repo.get_by_id(list_id)
        if not user_list:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        if not user_list.is_public:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This list is private")
        return user_list


    async def fork(self, list_id: int, user_id: int) -> UserList:
        """Copy a public list into the current user's collection."""
        original = await self.repo.get_by_id(list_id)
        self._check_exists(original)

        if not original.is_public:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot fork a private list")

        if original.user_id == user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot fork your own list")

        # Create new list
        new_list = await self.repo.create(
            user_id=user_id,
            name=f"Copy of {original.name}",
            description=original.description,
            is_public=False,
        )
        await self.db.flush()

        # Copy all films preserving position order
        original_films = await self.repo.get_films(list_id)
        for entry in original_films:
            film_entry = UserListFilm(
                list_id=new_list.id,
                film_id=entry.film_id,
                position=entry.position,
            )
            self.db.add(film_entry)

        await self.db.flush()

        # Build cover poster paths from copied films
        await self.repo.refresh_cover_poster_paths(new_list)

        await self.db.commit()
        await self.db.refresh(new_list)
        return new_list


    async def update(
            self,
            list_id: int,
            user_id: int,
            name: str | None = None,
            description: str | None = None,
            is_public: bool | None = None,
            cover_film_id: int | None = None,
            cover_film_ids: list[int] | None = None,
    ) -> UserList:
        """Update list metadata. Owner only."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)
        self._check_owner(user_list, user_id)

        if name is not None:
            user_list.name = name

        if description is not None:
            user_list.description = description

        if is_public is not None:
            user_list.is_public = is_public

        if cover_film_ids is not None:
            for film_id in cover_film_ids:
                entry = await self.repo.get_list_film(list_id, film_id)
                if not entry:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Film {film_id} is not in this list"
                    )

            result = await self.db.execute(
                select(Film.id, Film.poster_path)
                .where(Film.id.in_(cover_film_ids))
            )

            film_map = {row[0]: row[1] for row in result.all()}

            user_list.cover_film_ids = cover_film_ids
            user_list.cover_poster_paths = [
                film_map[fid] for fid in cover_film_ids
                if fid in film_map and film_map[fid]
            ]

        elif cover_film_id is not None:
            entry = await self.repo.get_list_film(list_id, cover_film_id)
            if not entry:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cover film must be in the list"
                )
            user_list.cover_film_id = cover_film_id

        await self.db.commit()
        await self.db.refresh(user_list)
        return user_list


    async def delete(self, list_id: int, user_id: int) -> None:
        """Delete a list. Owner only."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)
        self._check_owner(user_list, user_id)
        await self.repo.delete(user_list)
        await self.db.commit()


    async def add_film(self, list_id: int, user_id: int, tmdb_id: int) -> UserListFilm:
        """Add film to list. Owner only."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)
        self._check_owner(user_list, user_id)

        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        existing = await self.repo.get_list_film(list_id, film.id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Film already in this list")

        entry = await self.repo.add_film(list_id, film.id)

        if user_list.cover_film_id is None:
            user_list.cover_film_id = film.id

        await self.repo.refresh_cover_poster_paths(user_list)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry


    async def remove_film_by_tmdb(self, list_id: int, user_id: int, tmdb_id: int) -> None:
        """Remove a film from a user list by TMDb ID and refresh cover posters."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)
        self._check_owner(user_list, user_id)

        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        entry = await self.repo.get_list_film(list_id, film.id)
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not in this list")

        if user_list.cover_film_id == film.id:
            user_list.cover_film_id = None

        await self.repo.remove_film(entry)
        await self.repo.refresh_cover_poster_paths(user_list)
        await self.db.commit()


    async def get_films(
            self,
            list_id: int,
            user_id: int | None,
            **filters,
    ) -> tuple[list[UserListFilm], dict[int, int | None]]:
        """Get films in list. The public list is available without auth."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)

        if not user_list.is_public:
            if user_id is None or user_list.user_id != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This list is private")

        entries = await self.repo.get_films(list_id, user_id=user_id, **filters)

        user_ratings: dict[int, int | None] = {}
        if user_id:
            film_ids = [e.film.id for e in entries]
            if film_ids:
                result = await self.db.execute(
                    select(UserFilm.film_id, UserFilm.rating)
                    .where(and_(
                        UserFilm.user_id == user_id,
                        UserFilm.film_id.in_(film_ids),
                    ))
                )
                user_ratings = {row.film_id: row.rating for row in result.all()}

        for entry in entries:
            entry.film.poster_url = tmdb_client.get_image_url(entry.film.poster_path)

        return entries, user_ratings


    async def get_film_membership(self, user_id: int, tmdb_id: int) -> dict:
        """For modal: all user lists + which ones contain this film."""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)

        all_rows = await self.repo.get_all_for_user(user_id)

        lists_with_film_ids: set[int] = set()
        if film:
            lists_with_film = await self.repo.get_lists_for_film(user_id, film.id)
            lists_with_film_ids = {ul.id for ul in lists_with_film}

        return {
            "lists": [
                {
                    **self._serialize_list(user_list, film_count),
                    "has_film": user_list.id in lists_with_film_ids,
                }
                for user_list, film_count in all_rows
            ]
        }


    def _check_exists(self, user_list: UserList | None) -> None:
        """Raise 404 if the list does not exist."""
        if not user_list:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")


    def _check_owner(self, user_list: UserList, user_id: int) -> None:
        """Raise 403 if the user is not the list owner."""
        if user_list.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your list")


    def _serialize_list(self, user_list: UserList, film_count: int = 0) -> dict:
        """Serialize UserList to dict with computed poster URLs."""
        cover_urls = [
            tmdb_client.get_image_url(p)
            for p in (user_list.cover_poster_paths or [])
            if p
        ]

        return {
            "id": user_list.id,
            "name": user_list.name,
            "description": user_list.description,
            "is_public": user_list.is_public,
            "film_count": film_count,
            "cover_url": cover_urls[0] if cover_urls else None,
            "cover_urls": cover_urls,
            "cover_film_ids": user_list.cover_film_ids or [],
            "likes_count": user_list.likes_count,
            "views_count": user_list.views_count,
            "created_at": user_list.created_at,
            "updated_at": user_list.updated_at,
        }