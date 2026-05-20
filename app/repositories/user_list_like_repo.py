from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_list_like import UserListLike
from app.models.user_list import UserList


class UserListLikeRepository:
    """Repository for user list like operations."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get(self, user_id: int, list_id: int) -> UserListLike | None:
        """Get a like record for a user and list."""
        result = await self.db.execute(
            select(UserListLike).where(
                UserListLike.user_id == user_id,
                UserListLike.list_id == list_id,
            )
        )
        return result.scalar_one_or_none()


    async def create(self, user_id: int, list_id: int) -> UserListLike:
        """Create a like record."""
        entry = UserListLike(user_id=user_id, list_id=list_id)
        self.db.add(entry)
        await self.db.flush()
        return entry


    async def delete(self, entry: UserListLike) -> None:
        """Delete a like record."""
        await self.db.delete(entry)


    async def increment_likes(self, list_id: int) -> None:
        """Atomically increment likes_count on a list."""
        await self.db.execute(
            update(UserList)
            .where(UserList.id == list_id)
            .values(likes_count=UserList.likes_count + 1)
        )


    async def decrement_likes(self, list_id: int) -> None:
        """Atomically decrement likes_count on a list (floor at 0)."""
        await self.db.execute(
            update(UserList)
            .where(UserList.id == list_id, UserList.likes_count > 0)
            .values(likes_count=UserList.likes_count - 1)
        )


    async def get_liked_lists(self, user_id: int) -> list[int]:
        """Return list IDs liked by the user."""
        result = await self.db.execute(
            select(UserListLike.list_id).where(UserListLike.user_id == user_id)
        )
        return list(result.scalars().all())