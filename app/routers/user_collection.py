from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_async_db, get_user_film_service, get_user_favorite_service, get_user_list_service
from app.schemas.user_film import UserFilmResponse
from app.schemas.user_favorite import UserFavoriteResponse
from app.services.user_film_service import UserFilmService
from app.services.user_favorite_service import UserFavoriteService
from app.services.user_list_service import UserListService
from app.repositories.profile_repo import ProfileRepository


router = APIRouter(
    prefix="/users",
    tags=["user-collection-public"],
)


async def get_user_and_check_privacy(
    username: str,
    privacy_field: str,
    db: AsyncSession,
    viewer_id: int | None,
) -> int:
    """Resolves username → user_id + checks privacy."""
    repo = ProfileRepository(db) # profile repo instance
    user = await repo.get_by_username(username) # fetch user by username
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    is_owner = viewer_id is not None and viewer_id == user.id

    # privacy check for non-owner
    if not is_owner:
        if not getattr(user, privacy_field, True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This section is private",
            )

    return user.id  # return resolved user_id


@router.get("/{username}/films/want-to-watch", response_model=list[UserFilmResponse])
async def get_want_to_watch(
        username: str,
        request: Request,
        db: AsyncSession = Depends(get_async_db),
        service: UserFilmService = Depends(get_user_film_service),
        sort: str = Query(default="added_desc"),
        genre_id: int | None = Query(default=None),
        year: int | None = Query(default=None),
        year_from: int | None = Query(default=None),
        year_to: int | None = Query(default=None),
        upcoming: bool = Query(default=False),
        runtime_min: int | None = Query(default=None),
        runtime_max: int | None = Query(default=None),
        search: str | None = Query(default=None),
):
    """Returns user's 'want to watch' list."""
    viewer = request.state.user
    user_id = await get_user_and_check_privacy(
        username, "want_to_watch_public", db, viewer.id if viewer else None
    )
    return await service.get_watchlist(
        user_id, sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        upcoming=upcoming,
        runtime_min=runtime_min, runtime_max=runtime_max, search=search,
    )


@router.get("/{username}/films/watching", response_model=list[UserFilmResponse])
async def get_watching(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
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
    """Returns films user is currently watching."""
    viewer = request.state.user
    user_id = await get_user_and_check_privacy(
        username, "watching_public", db, viewer.id if viewer else None
    )

    return await service.get_watching(
        user_id, sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max, search=search,
    )


@router.get("/{username}/films/completed", response_model=list[UserFilmResponse])
async def get_completed(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
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
    """Returns completed films."""
    viewer = request.state.user
    user_id = await get_user_and_check_privacy(
        username, "completed_public", db, viewer.id if viewer else None
    )

    return await service.get_completed(
        user_id, sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max,
        rated_only=rated_only, unrated_only=unrated_only, search=search,
    )


@router.get("/{username}/films/dropped", response_model=list[UserFilmResponse])
async def get_dropped(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
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
    """Returns dropped/abandoned films."""
    viewer = request.state.user
    user_id = await get_user_and_check_privacy(
        username, "dropped_public", db, viewer.id if viewer else None
    )

    return await service.get_dropped(
        user_id, sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max, search=search,
    )


@router.get("/{username}/favorites", response_model=list[UserFavoriteResponse])
async def get_favorites(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    service: UserFavoriteService = Depends(get_user_favorite_service),
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
    """Returns user's favorite films."""
    viewer = request.state.user
    user_id = await get_user_and_check_privacy(
        username, "favorites_public", db, viewer.id if viewer else None
    )

    return await service.get_all(
        user_id, sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        runtime_min=runtime_min, runtime_max=runtime_max,
        rated_only=rated_only, unrated_only=unrated_only, search=search,
    )


@router.get("/{username}/lists")
async def get_lists(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    service: UserListService = Depends(get_user_list_service),
    sort: str = Query(default="updated_desc"),
    search: str | None = Query(default=None),
):
    """Returns user's lists."""
    viewer = request.state.user
    viewer_id = viewer.id if viewer else None

    user_id = await get_user_and_check_privacy(
        username, "lists_public", db, viewer_id
    )

    is_owner = viewer_id == user_id if viewer_id else False

    lists = await service.get_all(
        user_id,
        sort=sort,
        search=search,
        is_public=None if is_owner else True,
    )

    return lists