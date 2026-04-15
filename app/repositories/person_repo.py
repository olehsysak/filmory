from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.person import Person
from app.models.film_credit import FilmCredit


class PersonRepository:
    """Repository for person operations."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_by_tmdb_id(self, tmdb_id: int) -> Person | None:
        """Get person by TMDB ID."""
        result = await self.db.execute(
            select(Person)
            .where(Person.tmdb_id == tmdb_id)
        )
        return result.scalar_one_or_none()


    async def create(self, person_data: dict) -> Person:
        """Create new person in database."""
        person = Person(**person_data)
        self.db.add(person)
        await self.db.flush()
        return person


    async def get_or_create(self, person_data: dict) -> Person:
        """Get existing person or create new one by tmdb_id."""
        person = await self.get_by_tmdb_id(person_data["tmdb_id"])
        if not person:
            person = await self.create(person_data)
        return person