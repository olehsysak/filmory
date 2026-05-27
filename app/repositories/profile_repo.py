from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.models.user import User
from app.models.user_film import UserFilm, WatchStatus
from app.models.user_favorite import UserFavorite
from app.models.user_list import UserList
from app.models.film import Film
from app.models.genre import Genre
from app.models.film_genre import film_genre


class ProfileRepository:
    """Repository for profile-related data access."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_by_username(self, username: str) -> User | None:
        """Get user by username."""
        return await self.db.scalar(
            select(User).where(User.username == username)
        )


    async def get_by_id(self, user_id: int) -> User | None:
        """Get user by ID."""
        return await self.db.scalar(
            select(User).where(User.id == user_id)
        )


    async def get_stats(self, user_id: int) -> dict:
        """Full profile stats in minimal queries."""
        current_year = datetime.now().year

        # Status counts + hours + this year count — one query
        status_result = await self.db.execute(
            select(
                func.count(UserFilm.id).filter(
                    UserFilm.status == WatchStatus.want_to_watch
                ).label("want_to_watch"),
                func.count(UserFilm.id).filter(
                    UserFilm.status == WatchStatus.watching
                ).label("watching"),
                func.count(UserFilm.id).filter(
                    UserFilm.status == WatchStatus.completed
                ).label("completed"),
                func.count(UserFilm.id).filter(
                    UserFilm.status == WatchStatus.dropped
                ).label("dropped"),
                func.coalesce(
                    func.sum(Film.runtime).filter(
                        UserFilm.status == WatchStatus.completed
                    ), 0
                ).label("total_minutes"),
                func.count(UserFilm.id).filter(
                    and_(
                        UserFilm.status == WatchStatus.completed,
                        extract("year", UserFilm.added_at) == current_year,
                    )
                ).label("this_year"),
            )
            .join(Film, Film.id == UserFilm.film_id)
            .where(UserFilm.user_id == user_id)
        )
        row = status_result.one()

        # Avg rating + rated count
        rating_result = await self.db.execute(
            select(
                func.round(func.avg(UserFilm.rating), 1),
                func.count(UserFilm.id),
            )
            .where(and_(
                UserFilm.user_id == user_id,
                UserFilm.rating.isnot(None),
            ))
        )
        rating_row = rating_result.one()

        # Rating distribution: {1: n, 2: n, ..., 10: n}
        dist_result = await self.db.execute(
            select(UserFilm.rating, func.count(UserFilm.id))
            .where(and_(
                UserFilm.user_id == user_id,
                UserFilm.rating.isnot(None),
            ))
            .group_by(UserFilm.rating)
            .order_by(UserFilm.rating)
        )
        rating_distribution = {r: c for r, c in dist_result.all()}
        # Fill missing ratings with 0
        full_distribution = {i: rating_distribution.get(i, 0) for i in range(1, 11)}

        # Favorites count
        fav_count = await self.db.scalar(
            select(func.count(UserFavorite.id))
            .where(UserFavorite.user_id == user_id)
        )

        # Lists: public + private counts
        lists_result = await self.db.execute(
            select(
                func.count(UserList.id).filter(
                    UserList.is_public.is_(True)
                ).label("public"),
                func.count(UserList.id).filter(
                    UserList.is_public.is_(False)
                ).label("private"),
            )
            .where(UserList.user_id == user_id)
        )
        lists_row = lists_result.one()
        public_lists = lists_row.public
        private_lists = lists_row.private

        # Liked lists count
        from app.models.user_list_like import UserListLike
        liked_lists_count = await self.db.scalar(
            select(func.count(UserListLike.id))
            .where(UserListLike.user_id == user_id)
        ) or 0

        total_minutes = row.total_minutes or 0

        return {
            "want_to_watch": row.want_to_watch,
            "watching": row.watching,
            "films_seen": row.completed,
            "dropped": row.dropped,
            "this_year": row.this_year,
            "hours_watched": total_minutes // 60,
            "minutes_watched": total_minutes % 60,
            "avg_rating": float(rating_row[0]) if rating_row[0] else None,
            "rated_count": rating_row[1],
            "rating_distribution": full_distribution,
            "favorites_count": fav_count or 0,
            "public_lists_count": public_lists,
            "private_lists_count": private_lists,
            "total_lists_count": public_lists + private_lists,
            "liked_lists_count": liked_lists_count,
        }


    async def get_top_genres(self, user_id: int, limit: int = 6) -> list[str]:
        """Top genres by count of completed films."""
        result = await self.db.execute(
            select(Genre.name, func.count(Genre.id).label("cnt"))
            .join(film_genre, film_genre.c.genre_id == Genre.id)
            .join(Film, Film.id == film_genre.c.film_id)
            .join(UserFilm, UserFilm.film_id == Film.id)
            .where(and_(
                UserFilm.user_id == user_id,
                UserFilm.status == WatchStatus.completed,
            ))
            .group_by(Genre.id, Genre.name)
            .order_by(func.count(Genre.id).desc())
            .limit(limit)
        )

        return [row[0] for row in result.all()]


    async def get_pinned_films(self, film_ids: list[int]) -> list[Film]:
        """Get pinned films while preserving original order."""
        if not film_ids:
            return []

        result = await self.db.execute(
            select(Film).where(Film.id.in_(film_ids))
        )
        films = result.scalars().all()

        film_map = {f.id: f for f in films}

        return [film_map[fid] for fid in film_ids if fid in film_map]


    async def get_pinned_lists(self, list_ids: list[int], viewer_id: int | None) -> list[UserList]:
        """Get pinned lists with optional privacy filtering."""
        if not list_ids:
            return []
        query = (
            select(UserList)
            .options(joinedload(UserList.cover_film))
            .where(UserList.id.in_(list_ids))
        )

        # Hide private lists for anonymous users
        if viewer_id is None:
            query = query.where(UserList.is_public.is_(True))

        result = await self.db.execute(query)
        lists = result.scalars().unique().all()

        list_map = {lst.id: lst for lst in lists}

        return [list_map[lid] for lid in list_ids if lid in list_map]


    async def get_recent_activity(self, user_id: int, limit: int = 10) -> list[dict]:
        """Get combined recent activity feed."""
        # Recently updated films
        films_result = await self.db.execute(
            select(UserFilm, Film)
            .join(Film, Film.id == UserFilm.film_id)
            .where(UserFilm.user_id == user_id)
            .order_by(UserFilm.added_at.desc())
            .limit(limit)
        )

        # Recently favorited films
        fav_result = await self.db.execute(
            select(UserFavorite, Film)
            .join(Film, Film.id == UserFavorite.film_id)
            .where(UserFavorite.user_id == user_id)
            .order_by(UserFavorite.added_at.desc())
            .limit(limit)
        )

        # Recently updated public lists
        list_result = await self.db.execute(
            select(UserList)
            .where(and_(
                UserList.user_id == user_id,
                UserList.is_public.is_(True),
            ))
            .order_by(UserList.updated_at.desc())
            .limit(limit)
        )

        activity = []

        # Film status activity
        for user_film, film in films_result.all():
            activity.append({
                "type": "status",
                "action": f"Added to {user_film.status.value.replace('_', ' ')}",
                "film_title": film.title,
                "film_tmdb_id": film.tmdb_id,
                "film_poster_path": film.poster_path,
                "rating": user_film.rating,
                "date": user_film.added_at,
            })

        # Favorites activity
        for favorite, film in fav_result.all():
            activity.append({
                "type": "favorite",
                "action": "Added to favorites",
                "film_title": film.title,
                "film_tmdb_id": film.tmdb_id,
                "film_poster_path": film.poster_path,
                "rating": None,
                "date": favorite.added_at,
            })

        # Lists activity
        for user_list in list_result.scalars().all():
            activity.append({
                "type": "list",
                "action": "Updated list",
                "list_name": user_list.name,
                "list_id": user_list.id,
                "film_title": None,
                "film_tmdb_id": None,
                "film_poster_path": None,
                "rating": None,
                "date": user_list.updated_at,
            })

        # Sort all activity items by date descending
        activity.sort(key=lambda x: x["date"], reverse=True)

        return activity[:limit]


    async def search_users(
        self,
        q: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[User]:
        """Search active users by username. Prefix matches ranked first."""
        result = await self.db.execute(
            select(User)
            .where(
                User.is_active == True,
                User.username.ilike(f"%{q}%"),
            )
            .order_by(
                # Prefix match ranks higher than mid-string match
                User.username.ilike(f"{q}%").desc(),
                User.username.asc(),
            )
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())


    async def update(self, user: User, **fields) -> User:
        """Update user profile fields."""
        for key, value in fields.items():
            setattr(user, key, value)

        await self.db.commit()
        await self.db.refresh(user)

        return user