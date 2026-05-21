from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta, timezone
from app.dependencies import get_async_db
from app.models.user import User
from app.models.user_film import UserFilm, WatchStatus
from app.models.user_list import UserList
from app.models.user_list_film import UserListFilm
from app.models.user_list_like import UserListLike
from app.models.user_list_view import UserListView
from app.clients.tmdb_client import tmdb_client


router = APIRouter(
    prefix="/community",
    tags=["community"],
)


def month_ago() -> datetime:
    """Returns UTC datetime from 30 days ago."""
    return datetime.now(timezone.utc) - timedelta(days=30)


def serialize_list(user_list: UserList, author: User, film_count: int) -> dict:
    """Converts UserList ORM object into API response dictionary."""
    # Convert poster paths into full TMDB image URLs
    cover_urls = [
        tmdb_client.get_image_url(p)
        for p in (user_list.cover_poster_paths or [])
        if p
    ]
    return {
        "id": user_list.id,
        "name": user_list.name,
        "description": user_list.description,
        "author_username": author.username,
        "author_avatar_url": (
            f"/static/uploads/avatars/{author.avatar_path}"
            if author.avatar_path else None
        ),
        "film_count": film_count,
        "cover_urls": cover_urls,
        "likes_count": user_list.likes_count,
        "views_count": user_list.views_count,
        "created_at": user_list.created_at,
        "updated_at": user_list.updated_at,
    }


@router.get("/people/top-watchers")
async def get_top_watchers(
    db: AsyncSession = Depends(get_async_db),
    limit: int = 5,
):
    """Users with most completed films this month + ratings stats."""
    since = month_ago()

    # Number of recently completed films per user
    recent_completed = (
        select(func.count(UserFilm.id))
        .where(
            UserFilm.user_id == User.id,
            UserFilm.status == WatchStatus.completed,
            UserFilm.added_at >= since,
        )
        .correlate(User)
        .scalar_subquery()
    )

    # Number of rated films in the same period
    ratings_count = (
        select(func.count(UserFilm.id))
        .where(
            UserFilm.user_id == User.id,
            UserFilm.rating.isnot(None),
            UserFilm.added_at >= since,
        )
        .correlate(User)
        .scalar_subquery()
    )

    # Average rating in the same period
    avg_rating = (
        select(func.round(func.avg(UserFilm.rating), 1))
        .where(
            UserFilm.user_id == User.id,
            UserFilm.rating.isnot(None),
            UserFilm.added_at >= since,
        )
        .correlate(User)
        .scalar_subquery()
    )

    # Total completed films (all time)
    total_completed = (
        select(func.count(UserFilm.id))
        .where(
            UserFilm.user_id == User.id,
            UserFilm.status == WatchStatus.completed,
        )
        .correlate(User)
        .scalar_subquery()
    )

    # Users with computed statistics
    result = await db.execute(
        select(
            User,
            recent_completed.label("recent_watched"),
            total_completed.label("total_watched"),
            ratings_count.label("ratings_count"),
            avg_rating.label("avg_rating"),
        )
        .where(User.is_active.is_(True), recent_completed > 0)
        .order_by(recent_completed.desc())
        .limit(limit)
    )

    return [
        {
            "username": user.username,
            "bio": user.bio,
            "avatar_url": f"/static/uploads/avatars/{user.avatar_path}" if user.avatar_path else None,
            "recent_watched": recent_watched,
            "total_watched": total_watched,
            "ratings_count": ratings_count,
            "avg_rating": float(avg_rating) if avg_rating else None,
        }
        for user, recent_watched, total_watched, ratings_count, avg_rating in result.all()
    ]


@router.get("/people/top-curators")
async def get_top_curators(
    db: AsyncSession = Depends(get_async_db),
    limit: int = 5,
):
    """Users whose lists received most likes + views this month."""
    since = month_ago()

    # Number of likes on user's lists in the recent period
    recent_likes = (
        select(func.count(UserListLike.id))
        .join(UserList, UserList.id == UserListLike.list_id)
        .where(
            UserList.user_id == User.id,
            UserListLike.created_at >= since,
        )
        .correlate(User)
        .scalar_subquery()
    )

    # Number of views on user's lists in the recent period
    recent_views = (
        select(func.count(UserListView.id))
        .join(UserList, UserList.id == UserListView.list_id)
        .where(
            UserList.user_id == User.id,
            UserListView.viewed_at >= since,
        )
        .correlate(User)
        .scalar_subquery()
    )

    # Total number of public lists per user
    public_lists = (
        select(func.count(UserList.id))
        .where(UserList.user_id == User.id, UserList.is_public.is_(True))
        .correlate(User)
        .scalar_subquery()
    )

    # Total likes across all public lists (all time)
    total_likes = (
        select(func.coalesce(func.sum(UserList.likes_count), 0))
        .where(UserList.user_id == User.id, UserList.is_public.is_(True))
        .correlate(User)
        .scalar_subquery()
    )

    # Users ranked by recent list engagement
    result = await db.execute(
        select(
            User,
            recent_likes.label("recent_likes"),
            recent_views.label("recent_views"),
            public_lists.label("public_lists"),
            total_likes.label("total_likes"),
        )
        .where(User.is_active.is_(True), recent_likes > 0)
        .order_by(recent_likes.desc())
        .limit(limit)
    )

    return [
        {
            "username": user.username,
            "bio": user.bio,
            "avatar_url": f"/static/uploads/avatars/{user.avatar_path}" if user.avatar_path else None,
            "recent_likes": recent_likes,
            "recent_views": recent_views,
            "public_lists": public_lists,
            "total_likes": total_likes,
        }
        for user, recent_likes, recent_views, public_lists, total_likes in result.all()
    ]


@router.get("/lists/most-liked")
async def get_most_liked_lists(
    db: AsyncSession = Depends(get_async_db),
    limit: int = 6,
):
    """Returns most liked public lists within the last 30 days."""
    since = month_ago()

    # Number of films in each list
    film_count_sq = (
        select(func.count(UserListFilm.id))
        .where(UserListFilm.list_id == UserList.id)
        .correlate(UserList)
        .scalar_subquery()
    )

    # Recent likes per list
    recent_likes_sq = (
        select(func.count(UserListLike.id))
        .where(UserListLike.list_id == UserList.id, UserListLike.created_at >= since)
        .correlate(UserList)
        .scalar_subquery()
    )

    # Public lists with recent engagement
    result = await db.execute(
        select(UserList, User, film_count_sq.label("film_count"))
        .join(User, User.id == UserList.user_id)
        .where(UserList.is_public.is_(True), recent_likes_sq > 0)
        .order_by(recent_likes_sq.desc())
        .limit(limit)
    )

    # Serialize response using shared helper
    return [serialize_list(ul, author, fc) for ul, author, fc in result.all()]


@router.get("/lists/most-viewed")
async def get_most_viewed_lists(
    db: AsyncSession = Depends(get_async_db),
    limit: int = 8,
):
    """Returns most viewed public lists within the last 30 days."""
    since = month_ago()

    # Number of films in each list
    film_count_sq = (
        select(func.count(UserListFilm.id))
        .where(UserListFilm.list_id == UserList.id)
        .correlate(UserList)
        .scalar_subquery()
    )

    # Recent views per list
    recent_views_sq = (
        select(func.count(UserListView.id))
        .where(UserListView.list_id == UserList.id, UserListView.viewed_at >= since)
        .correlate(UserList)
        .scalar_subquery()
    )

    # Public lists ranked by recent views
    result = await db.execute(
        select(UserList, User, film_count_sq.label("film_count"), recent_views_sq.label("recent_views"))
        .join(User, User.id == UserList.user_id)
        .where(UserList.is_public.is_(True), recent_views_sq > 0)
        .order_by(recent_views_sq.desc())
        .limit(limit)
    )

    # Serialize response and attach recent views
    return [
        {**serialize_list(ul, author, fc), "recent_views": rv}
        for ul, author, fc, rv in result.all()
    ]


@router.get("/lists/new")
async def get_new_lists(
    db: AsyncSession = Depends(get_async_db),
    limit: int = 6,
):
    """Returns newly created public lists from the last 30 days."""
    since = month_ago()

    # Number of films in each list
    film_count_sq = (
        select(func.count(UserListFilm.id))
        .where(UserListFilm.list_id == UserList.id)
        .correlate(UserList)
        .scalar_subquery()
    )

    # Newest public lists
    result = await db.execute(
        select(UserList, User, film_count_sq.label("film_count"))
        .join(User, User.id == UserList.user_id)
        .where(UserList.is_public.is_(True), UserList.created_at >= since)
        .order_by(UserList.created_at.desc())
        .limit(limit)
    )

    return [serialize_list(ul, author, fc) for ul, author, fc in result.all()]