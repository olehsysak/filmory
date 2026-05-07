from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_film_repo import UserFilmRepository
from app.repositories.film_repo import FilmRepository
from app.models.user_film import UserFilm, WatchStatus
from app.clients.tmdb_client import tmdb_client
from datetime import datetime, timezone
from fastapi import status, HTTPException


class UserFilmService:
    """Service for user film interactions: watchlist, favorites, ratings"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserFilmRepository(db)
        self.film_repo = FilmRepository(db)


    async def add_to_watchlist(self, user_id: int, tmdb_id: int) -> UserFilm:
        """Add film to watchlist with want_to_watch status"""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        existing = await self.repo.get(user_id, film.id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Film already in your list")

        await self.repo.create(user_id, film.id, WatchStatus.want_to_watch)
        await self.db.commit()

        return await self.repo.get(user_id, film.id)


    async def set_status(self, user_id: int, tmdb_id: int, watch_status: WatchStatus) -> UserFilm:
        """Set watch status for a film"""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        entry = await self.repo.get(user_id, film.id)
        if not entry:
            entry = await self.repo.create(user_id, film.id, watch_status)
        else:
            entry.status = watch_status

        if watch_status == WatchStatus.completed:
            entry.watched_at = datetime.now(timezone.utc)

        if watch_status in (WatchStatus.want_to_watch, WatchStatus.watching, WatchStatus.dropped):
            entry.rating = None
            entry.is_favorite = False

        await self.db.commit()

        return await self.repo.get(user_id, film.id)


    async def set_rating(self, user_id: int, tmdb_id: int, rating: int) -> UserFilm:
        """Set rating"""
        if not (1 <= rating <= 10):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="Rating must be between 1 and 10")

        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        entry = await self.repo.get(user_id, film.id)
        if not entry:
            await self.repo.create(user_id, film.id, WatchStatus.completed)
            await self.db.flush()
            entry = await self.repo.get(user_id, film.id)
            entry.watched_at = datetime.now(timezone.utc)

        entry.rating = rating
        await self.db.commit()

        return await self.repo.get(user_id, film.id)


    async def remove(self, user_id: int, tmdb_id: int) -> None:
        """Remove film from user list entirely"""
        film = await self.film_repo.get_by_tmdb_id(tmdb_id)
        if not film:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")

        entry = await self.repo.get(user_id, film.id)
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not in your list")

        await self.repo.delete(entry)
        await self.db.commit()


    async def get_watchlist(self, user_id: int) -> list[UserFilm]:
        """Get all films with want_to_watch status"""
        entries = await self.repo.get_by_status(user_id, WatchStatus.want_to_watch)
        for e in entries:
            e.film.poster_url = tmdb_client.get_image_url(e.film.poster_path)
        return entries


    async def get_watching(self, user_id: int) -> list[UserFilm]:
        """Get all films with watching status"""
        entries = await self.repo.get_by_status(user_id, WatchStatus.watching)
        for e in entries:
            e.film.poster_url = tmdb_client.get_image_url(e.film.poster_path)
        return entries


    async def get_completed(self, user_id: int) -> list[UserFilm]:
        """Get all completed films"""
        entries = await self.repo.get_by_status(user_id, WatchStatus.completed)
        for e in entries:
            e.film.poster_url = tmdb_client.get_image_url(e.film.poster_path)
        return entries


    async def get_dropped(self, user_id: int) -> list[UserFilm]:
        """Get all dropped films"""
        entries = await self.repo.get_by_status(user_id, WatchStatus.dropped)
        for e in entries:
            e.film.poster_url = tmdb_client.get_image_url(e.film.poster_path)
        return entries