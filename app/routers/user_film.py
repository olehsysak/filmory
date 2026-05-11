from fastapi import APIRouter, Depends, Query, status
from app.dependencies import get_user_film_service, get_current_user
from app.schemas.user_film import UserFilmResponse, UserFilmStatusUpdate, UserFilmRatingUpdate, UserFilmStateResponse
from app.services.user_film_service import UserFilmService
from app.models.user import User


router = APIRouter(
    prefix="/user/films",
    tags=["user-films"],
)


@router.get("/state/{tmdb_id}", response_model=UserFilmStateResponse)
async def get_film_state(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
):
    """Get current watch state for a film."""
    entry = await service.get_state(current_user.id, tmdb_id)
    if not entry:
        return UserFilmStateResponse(status=None, rating=None)
    return UserFilmStateResponse(status=entry.status, rating=entry.rating)


@router.get("/want-to-watch", response_model=list[UserFilmResponse])
async def get_want_to_watch(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    runtime_min: int | None = Query(default=None),
    runtime_max: int | None = Query(default=None),
    search: str | None = Query(default=None),
):
    """Get films with 'want to watch' status."""
    return await service.get_watchlist(
        current_user.id,
        sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max,
        search=search,
    )


@router.get("/watching", response_model=list[UserFilmResponse])
async def get_watching(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    runtime_min: int | None = Query(default=None),
    runtime_max: int | None = Query(default=None),
    search: str | None = Query(default=None),
):
    """Get films with 'watching' status."""
    return await service.get_watching(
        current_user.id,
        sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max,
        search=search,
    )


@router.get("/completed", response_model=list[UserFilmResponse])
async def get_completed(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    runtime_min: int | None = Query(default=None),
    runtime_max: int | None = Query(default=None),
    rated_only: bool = Query(default=False),
    unrated_only: bool = Query(default=False),
    search: str | None = Query(default=None),
):
    """Get films with 'completed' status."""
    return await service.get_completed(
        current_user.id,
        sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max,
        rated_only=rated_only, unrated_only=unrated_only, search=search,
    )


@router.get("/dropped", response_model=list[UserFilmResponse])
async def get_dropped(
    current_user: User = Depends(get_current_user),
    service: UserFilmService = Depends(get_user_film_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    runtime_min: int | None = Query(default=None),
    runtime_max: int | None = Query(default=None),
    search: str | None = Query(default=None),
):
    """Get films with 'dropped' status."""
    return await service.get_dropped(
        current_user.id,
        sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max,
        search=search,
    )


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