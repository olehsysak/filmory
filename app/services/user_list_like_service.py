from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.repositories.user_list_like_repo import UserListLikeRepository
from app.repositories.user_list_repo import UserListRepository
from app.clients.tmdb_client import tmdb_client


class UserListLikeService:
    """Service for toggling likes on public lists."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserListLikeRepository(db)
        self.list_repo = UserListRepository(db)


    async def toggle(self, user_id: int, list_id: int) -> dict:
        """Toggle like on a list."""
        user_list = await self.list_repo.get_by_id(list_id)

        if not user_list:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")

        if not user_list.is_public:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot like a private list")

        if user_list.user_id == user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot like your own list")

        existing = await self.repo.get(user_id, list_id)

        if existing:
            await self.repo.delete(existing)
            await self.repo.decrement_likes(list_id)
            await self.db.commit()
            liked = False
        else:
            await self.repo.create(user_id, list_id)
            await self.repo.increment_likes(list_id)
            await self.db.commit()
            liked = True

        updated = await self.list_repo.get_by_id(list_id)
        return {"liked": liked, "likes_count": updated.likes_count}


    async def get_liked_lists(
        self,
        user_id: int,
        sort: str = "liked_desc",
        search: str | None = None,
    ) -> list[dict]:
        """Get all public lists liked by the user, with sort, search, and views_count."""
        liked_ids = await self.repo.get_liked_lists(user_id)

        if not liked_ids:
            return []

        rows = await self.list_repo.get_liked_lists_for_user(
            liked_ids, sort=sort, search=search
        )

        result = []
        for user_list, author, film_count in rows:
            cover_urls = [
                tmdb_client.get_image_url(p)
                for p in (user_list.cover_poster_paths or [])
                if p
            ]
            result.append({
                "id": user_list.id,
                "name": user_list.name,
                "description": user_list.description,
                "author_username": author.username,
                "author_avatar_url": (
                    f"/static/uploads/avatars/{author.avatar_path}"
                    if author.avatar_path else None
                ),
                "film_count": film_count,
                "cover_url": cover_urls[0] if cover_urls else None,
                "cover_urls": cover_urls,
                "likes_count": user_list.likes_count,
                "views_count": user_list.views_count,   # was missing
                "updated_at": user_list.updated_at,
            })

        return result