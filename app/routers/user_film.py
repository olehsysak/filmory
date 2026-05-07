from fastapi import APIRouter, Depends, status
from app.dependencies import get_user_film_service, get_current_user
from app.schemas.user_film import UserFilmResponse, UserFilmStatusUpdate, UserFilmRatingUpdate
from app.services.user_film_service import UserFilmService
from app.models.user import User


router = APIRouter(
    prefix="/user/films",
    tags=["user-films"],
)


@router.get("/want-to-watch", response_model=list[UserFilmResponse])
async def get_want_to_watch(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Get all films with want_to_watch status."""
    return await service.get_watchlist(current_user.id)


@router.get("/watching", response_model=list[UserFilmResponse])
async def get_watching(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Get all films currently being watched."""
    return await service.get_watching(current_user.id)


@router.get("/completed", response_model=list[UserFilmResponse])
async def get_completed(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Get all completed films."""
    return await service.get_completed(current_user.id)


@router.get("/dropped", response_model=list[UserFilmResponse])
async def get_dropped(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Get all dropped films."""
    return await service.get_dropped(current_user.id)


@router.post("/{tmdb_id}/watchlist", response_model=UserFilmResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Add film to watchlist (want_to_watch)."""
    return await service.add_to_watchlist(current_user.id, tmdb_id)


@router.patch("/{tmdb_id}/status", response_model=UserFilmResponse)
async def set_status(
    tmdb_id: int,
    body: UserFilmStatusUpdate,
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Update watch status for a film."""
    return await service.set_status(current_user.id, tmdb_id, body.status)


@router.patch("/{tmdb_id}/rating", response_model=UserFilmResponse)
async def set_rating(
    tmdb_id: int,
    body: UserFilmRatingUpdate,
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Set rating — auto-adds as completed if not in list."""
    return await service.set_rating(current_user.id, tmdb_id, body.rating)


@router.delete("/{tmdb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_film(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Remove film from user list entirely."""
    await service.remove(current_user.id, tmdb_id)