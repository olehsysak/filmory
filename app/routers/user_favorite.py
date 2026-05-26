from fastapi import APIRouter, Depends, Query, status
from app.dependencies import get_user_favorite_service, get_current_user
from app.schemas.user_favorite import UserFavoriteResponse, UserFavoriteStateResponse
from app.services.user_favorite_service import UserFavoriteService
from app.models.user import User


router = APIRouter(
    prefix="/user/favorites",
    tags=["user-favorites"],
)


@router.get("/state/{tmdb_id}", response_model=UserFavoriteStateResponse)
async def get_favorite_state(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserFavoriteService = Depends(get_user_favorite_service),
):
    """Check if film is in favorites."""
    is_favorite = await service.get_state(current_user.id, tmdb_id)
    return UserFavoriteStateResponse(is_favorite=is_favorite)


@router.get("/", response_model=list[UserFavoriteResponse])
async def get_favorites(
    current_user: User = Depends(get_current_user),
    service: UserFavoriteService = Depends(get_user_favorite_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    upcoming: bool = Query(default=False),
    runtime_min: int | None = Query(default=None),
    runtime_max: int | None = Query(default=None),
    rated_only: bool = Query(default=False),
    unrated_only: bool = Query(default=False),
    search: str | None = Query(default=None),
):
    """Get all user favorite films with filters and sorting."""
    return await service.get_all(
        current_user.id,
        sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        upcoming=upcoming,
        runtime_min=runtime_min, runtime_max=runtime_max,
        rated_only=rated_only, unrated_only=unrated_only, search=search,
    )


@router.post("/{tmdb_id}", response_model=UserFavoriteResponse, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserFavoriteService = Depends(get_user_favorite_service),
):
    """Add film to favorites."""
    return await service.add(current_user.id, tmdb_id)


@router.delete("/{tmdb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserFavoriteService = Depends(get_user_favorite_service),
):
    """Remove film from favorites."""
    await service.remove(current_user.id, tmdb_id)