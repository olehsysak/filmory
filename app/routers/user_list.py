from fastapi import APIRouter, Depends, Query, status, Request
from app.dependencies import get_async_db, get_current_user, get_user_list_service, get_user_list_like_service
from app.repositories.user_list_view_repo import UserListViewRepository
from app.repositories.user_list_repo import UserListRepository
from app.schemas.user_list import (
    UserListCreate, UserListUpdate,
    UserListResponse, UserListFilmResponse,
    UserListDetailResponse, FilmMembershipResponse,
    LikeToggleResponse, LikedListResponse,
)
from app.services.user_list_service import UserListService
from app.services.user_list_like_service import UserListLikeService
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/user/lists",
    tags=["user-lists"],
)


@router.get("/liked", response_model=list[LikedListResponse])
async def get_liked_lists(
    current_user: User = Depends(get_current_user),
    service: UserListLikeService = Depends(get_user_list_like_service),
    sort: str = Query(default="liked_desc"),
    search: str | None = Query(default=None),
):
    """Get all public lists liked by the current user, with sort and search."""
    return await service.get_liked_lists(current_user.id, sort=sort, search=search)


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
        cover_urls=[], cover_film_ids=[],
        likes_count=0, views_count=0,
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
    """Get all lists owned by the current user."""
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
    """Update list metadata. Owner only."""
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
    """Delete a user list. Owner only."""
    await service.delete(list_id, current_user.id)


@router.post("/{list_id}/like", response_model=LikeToggleResponse)
async def toggle_like(
    list_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListLikeService = Depends(get_user_list_like_service),
):
    """Toggle like on a public list. Cannot like own list."""
    result = await service.toggle(current_user.id, list_id)
    return LikeToggleResponse(**result)


@router.post("/{list_id}/fork", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def fork_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Copy a public list into the current user's collection. Cannot fork own list."""
    entry = await service.fork(list_id, current_user.id)

    return UserListResponse(
        id=entry.id, name=entry.name, description=entry.description,
        is_public=entry.is_public, film_count=0, cover_url=None,
        cover_urls=[], cover_film_ids=[],
        likes_count=0, views_count=0,
        created_at=entry.created_at, updated_at=entry.updated_at,
    )


@router.post("/{list_id}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_guest_view(
        list_id: int,
        request: Request,
        db: AsyncSession = Depends(get_async_db),
):
    """Record a view for guest users. Called from frontend sessionStorage logic."""
    # Skip if authenticated — already counted in get_detail
    if request.state.user:
        return

    list_repo = UserListRepository(db)
    user_list = await list_repo.get_by_id(list_id)

    # Only count views on public lists
    if not user_list or not user_list.is_public:
        return

    view_repo = UserListViewRepository(db)
    await view_repo.increment_views(list_id)
    await db.commit()


@router.get("/{list_id}/films", response_model=list[UserListFilmResponse])
async def get_list_films(
    list_id: int,
    request: Request,
    service: UserListService = Depends(get_user_list_service),
    sort: str = Query(default="added_desc"),
    genre_id: int | None = Query(default=None),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
    upcoming: bool = Query(default=False),
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
        sort=sort, genre_id=genre_id,
        year_from=year_from, year_to=year_to,
        upcoming=upcoming,
        runtime_min=runtime_min, runtime_max=runtime_max,
        search=search, rated_only=rated_only, unrated_only=unrated_only,
    )
    return [
        UserListFilmResponse(
            id=e.film.id, tmdb_id=e.film.tmdb_id,
            title=e.film.title, poster_url=e.film.poster_url,
            release_date=e.film.release_date, vote_average=e.film.vote_average,
            overview=e.film.overview, added_at=e.added_at,
            position=e.position, user_rating=user_ratings.get(e.film.id),
        )
        for e in entries
    ]


@router.post("/{list_id}/films/{tmdb_id}", status_code=status.HTTP_201_CREATED)
async def add_film_to_list(
    list_id: int,
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Add a film to a list by TMDB ID. Owner only."""
    await service.add_film(list_id, current_user.id, tmdb_id)
    return {"ok": True}


@router.delete("/{list_id}/films/{tmdb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_film_from_list(
    list_id: int,
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    service: UserListService = Depends(get_user_list_service),
):
    """Remove a film from a list by TMDB ID. Owner only."""
    await service.remove_film_by_tmdb(list_id, current_user.id, tmdb_id)
