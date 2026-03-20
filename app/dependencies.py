from fastapi import Request, status, HTTPException
from collections.abc import AsyncGenerator
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_maker


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Asynchronous SQLAlchemy session for database operations
    """
    async with async_session_maker() as session:
        yield session


def get_current_user(request: Request):
    """Get current authenticated user from request state."""
    if not request.state.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return request.state.user


def get_current_admin(request: Request):
    """Get current admin user."""
    user = get_current_user(request)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user