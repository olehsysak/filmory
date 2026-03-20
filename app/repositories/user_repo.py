from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User


class UserRepository:
    """Repository for user database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        """Get user by id."""
        result = await self.db.scalar(select(User).where(User.id == user_id))
        return result


    async def get_by_email(self, email: str) -> User | None:
        """Get user by email."""
        result = await self.db.scalar(select(User).where(User.email == email))
        return result


    async def get_by_username(self, username: str) -> User | None:
        """Get user by username."""
        result = await self.db.scalar(select(User).where(User.username == username))
        return result


    async def create(self, username: str, email: str, hashed_password: str) -> User:
        """Create new user."""
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user


    async def update_status(self, user_id: int, is_active: bool) -> User | None:
        """Update user active status (for admin)."""
        user = await self.get_by_id(user_id)
        if not user:
            return None
        user.is_active = is_active
        await self.db.commit()
        await self.db.refresh(user)
        return user