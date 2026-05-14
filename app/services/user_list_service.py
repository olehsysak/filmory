from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.repositories.user_list_repo import UserListRepository
from app.repositories.film_repo import FilmRepository
from app.models.user_list import UserList
from app.models.user_list_film import UserListFilm
from app.clients.tmdb_client import tmdb_client


class UserListService:
    """Service for user list operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserListRepository(db)
        self.film_repo = FilmRepository(db)


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
        result = []
        for user_list, film_count in rows:
            result.append(self._serialize_list(user_list, film_count))
        return result


    async def get_public(self, list_id: int) -> UserList:
        """Get list by ID — must be public (for public page)."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)
        if not user_list.is_public:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This list is private")
        return user_list


    async def update(
            self,
            list_id: int,
            user_id: int,
            name: str | None = None,
            description: str | None = None,
            is_public: bool | None = None,
            cover_film_id: int | None = None,
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
        if cover_film_id is not None:
            # Check that the movie is actually in this list
            film_entry = await self.repo.get_list_film(list_id, cover_film_id)
            if not film_entry:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cover film must be in the list")
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

        # Automatically set the cover if it doesn't already exist
        if user_list.cover_film_id is None:
            user_list.cover_film_id = film.id

        await self.db.commit()
        await self.db.refresh(entry)
        return entry


    async def remove_film_by_tmdb(self, list_id: int, user_id: int, tmdb_id: int) -> None:
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
        await self.db.commit()


    async def get_films(
            self,
            list_id: int,
            user_id: int | None,
            **filters,
    ) -> list[UserListFilm]:
        """Get films in list. The public list is available without auth."""
        user_list = await self.repo.get_by_id(list_id)
        self._check_exists(user_list)

        if not user_list.is_public:
            if user_id is None or user_list.user_id != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This list is private")

        entries = await self.repo.get_films(list_id, **filters)
        for entry in entries:
            entry.film.poster_url = tmdb_client.get_image_url(entry.film.poster_path)
        return entries


    async def get_film_membership(self, user_id: int, tmdb_id: int) -> dict:
        """For modal: all user lists + which ones contain this film."""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)

        # All user lists
        all_rows = await self.repo.get_all_for_user(user_id)

        # Lists that already contain this movie
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
        """Serialize UserList to dict with computed poster URL."""
        cover_url = None
        if user_list.cover_film:
            cover_url = tmdb_client.get_image_url(user_list.cover_film.poster_path)

        return {
            "id": user_list.id,
            "name": user_list.name,
            "description": user_list.description,
            "is_public": user_list.is_public,
            "film_count": film_count,
            "cover_url": cover_url,
            "created_at": user_list.created_at,
            "updated_at": user_list.updated_at,
        }