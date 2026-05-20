from fastapi import APIRouter, Depends, Query, status, Request
from app.dependencies import get_async_db, get_current_user
from app.schemas.user_list import (
    UserListCreate, UserListUpdate,
    UserListResponse, UserListFilmResponse,
    FilmMembershipResponse, UserListDetailResponse
)
from app.services.user_list_service import UserListService
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/user/lists",
    tags=["user-lists"],
)


def get_user_list_service(db: AsyncSession = Depends(get_async_db)) -> UserListService:
    return UserListService(db)


@router.post("/", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    data: UserListCreate,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Create a new user list."""
    entry = await service.create(current_user.id, data.name, data.description, data.is_public)
    return UserListResponse(
        id=entry.id, name=entry.name, description=entry.description,
        is_public=entry.is_public, film_count=0, cover_url=None,
        created_at=entry.created_at, updated_at=entry.updated_at,
    )


@router.get("/", response_model=list[UserListResponse])
async def get_lists(
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
    sort: str = Query(default="updated_desc"),
    is_public: bool | None = Query(default=None),
    search: str | None = Query(default=None),
):
    """Get all user lists."""
    return await service.get_all(current_user.id, sort=sort, is_public=is_public, search=search)


@router.get("/membership/{tmdb_id}", response_model=FilmMembershipResponse)
async def get_film_membership(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Return all user lists with has_film flag — for the 'Add to list' modal."""
    data = await service.get_film_membership(current_user.id, tmdb_id)
    return FilmMembershipResponse(**data)


@router.get("/{list_id}", response_model=UserListDetailResponse)
async def get_list_detail(
    list_id: int,
    request: Request,
    service: UserListService = Depends(get_user_list_service),
):
    """Get list metadata. Public lists accessible without auth."""
    user = request.state.user
    user_id = user.id if user else None
    data = await service.get_detail(list_id, user_id)
    return UserListDetailResponse(**data)


@router.patch("/{list_id}", response_model=UserListResponse)
async def update_list(
    list_id: int,
    data: UserListUpdate,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Update list metadata."""
    entry = await service.update(
        list_id, current_user.id,
        name=data.name,
        description=data.description,
        is_public=data.is_public,
        cover_film_id=data.cover_film_id,
        cover_film_ids=data.cover_film_ids,
    )
    rows = await service.repo.get_all_for_user(entry.user_id)
    film_count = next((fc for ul, fc in rows if ul.id == list_id), 0)

    return UserListResponse(**service._serialize_list(entry, film_count))


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Delete a user list."""
    await service.delete(list_id, current_user.id)


@router.get("/{list_id}/films", response_model=list[UserListFilmResponse])
async def get_list_films(
    list_id: int,
    request: Request,
    service: UserListService = Depends(get_user_list_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    runtime_min: int | None = Query(default=None),
    runtime_max: int | None = Query(default=None),
    search: str | None = Query(default=None),
    rated_only: bool = Query(default=False),
    unrated_only: bool = Query(default=False),
):
    """Get films in a list. Public lists accessible without auth."""
    user = request.state.user
    user_id = user.id if user else None

    entries, user_ratings = await service.get_films(
        list_id, user_id,
        sort=sort, genre_id=genre_id, year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max, search=search,
        rated_only=rated_only, unrated_only=unrated_only,
    )
    return [
        UserListFilmResponse(
            id=entry.film.id,
            tmdb_id=entry.film.tmdb_id,
            title=entry.film.title,
            poster_url=entry.film.poster_url,
            release_date=entry.film.release_date,
            vote_average=entry.film.vote_average,
            overview=entry.film.overview,
            added_at=entry.added_at,
            position=entry.position,
            user_rating=user_ratings.get(entry.film.id),
        )
        for entry in entries
    ]


@router.post("/{list_id}/films/{tmdb_id}", status_code=status.HTTP_201_CREATED)
async def add_film(
    list_id: int,
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Add film to list."""
    await service.add_film(list_id, current_user.id, tmdb_id)
    return {"detail": "Film added to list"}


@router.delete("/{list_id}/films/{tmdb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_film(
    list_id: int,
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Remove film from list by TMDB ID."""
    await service.remove_film_by_tmdb(list_id, current_user.id, tmdb_id)
