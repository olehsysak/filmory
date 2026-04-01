from sqlalchemy.ext.asyncio import AsyncSession
from app.clients.tmdb_client import tmdb_client
from app.repositories.genre_repo import GenreRepository


async def sync_genres(db: AsyncSession) -> None:
    """Fetch all genres from TMDB and save to DB."""
    genres = await tmdb_client.get_genres()
    genre_repo = GenreRepository(db)
    await genre_repo.bulk_create_or_update(genres)
    await db.commit()