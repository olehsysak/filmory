from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_list_view import UserListView
from app.models.user_list import UserList


class UserListViewRepository:
    """Repository for tracking unique list views per user."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get(self, user_id: int, list_id: int) -> UserListView | None:
        """Check if user has already viewed this list."""
        result = await self.db.execute(
            select(UserListView).where(
                UserListView.user_id == user_id,
                UserListView.list_id == list_id,
            )
        )
        return result.scalar_one_or_none()


    async def create(self, user_id: int, list_id: int) -> UserListView:
        """Record a new unique view."""
        entry = UserListView(user_id=user_id, list_id=list_id)
        self.db.add(entry)
        await self.db.flush()
        return entry


    async def increment_views(self, list_id: int) -> None:
        """Atomically increment views_count on the list."""
        await self.db.execute(
            update(UserList)
            .where(UserList.id == list_id)
            .values(views_count=UserList.views_count + 1)
        )