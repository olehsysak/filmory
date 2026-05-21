from fastapi import Request, status, HTTPException, Depends
from collections.abc import AsyncGenerator
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_maker
from app.services.film_service import FilmService
from app.services.auth_service import AuthService
from app.services.genre_service import GenreService
from app.services.person_service import PersonService
from app.services.user_film_service import UserFilmService
from app.services.user_favorite_service import UserFavoriteService
from app.services.user_list_service import UserListService
from app.services.profile_service import ProfileService
from app.services.user_list_like_service import UserListLikeService


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """Asynchronous SQLAlchemy session for database operations."""
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


def get_film_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for FilmService."""
    return FilmService(db)


def get_auth_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for AuthService."""
    return AuthService(db)


def get_genre_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for GenreService."""
    return GenreService(db)


def get_person_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for PersonService."""
    return PersonService(db)


def get_search_services(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for unified search (film + person)."""
    return FilmService(db), PersonService(db)


def get_user_film_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for UserFilmService."""
    return UserFilmService(db)


def get_user_favorite_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for UserFavoriteService."""
    return UserFavoriteService(db)


def get_user_list_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for UserListService."""
    return UserListService(db)


def get_profile_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for ProfileService."""
    return ProfileService(db)

def get_user_list_like_service(db: AsyncSession = Depends(get_async_db)):
    """FastAPI dependency for UserListLikeService."""
    return UserListLikeService(db)