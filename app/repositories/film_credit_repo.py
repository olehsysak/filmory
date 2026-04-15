from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.film_credit import FilmCredit
from app.models.person import Person


class FilmCreditRepository:
    """Repository for film credit operations."""

    def __init__(self, db: AsyncSession):
        self.db = db


    async def get_film_credits(self, film_id: int) -> list[FilmCredit]:
        """Get all credits for a film (cast + crew)."""
        result = await self.db.execute(
            select(FilmCredit)
            .options(selectinload(FilmCredit.person))
            .where(FilmCredit.film_id == film_id)
            .order_by(FilmCredit.credit_order.asc().nulls_last())
        )
        return list(result.scalars().all())


    async def has_credits(self, film_id: int) -> bool:
        """Check if film already has credits cached in DB."""
        result = await self.db.execute(
            select(FilmCredit.id)
            .where(FilmCredit.film_id == film_id)
            .limit(1)
        )
        return result.scalar_one_or_none() is not None


    async def create_credit(self, credit_data: dict) -> FilmCredit:
        """Create a single film credit."""
        credit = FilmCredit(**credit_data)
        self.db.add(credit)
        await self.db.flush()
        return credit


    async def bulk_create_credits(self, credits_data: list[dict]) -> None:
        """Bulk insert film credits."""
        credits = [FilmCredit(**data) for data in credits_data]
        self.db.add_all(credits)
        await self.db.flush()


    async def get_person_credits(self, person_id: int) -> list[FilmCredit]:
        """Get all film credits for a person."""
        result = await self.db.execute(
            select(FilmCredit)
            .options(selectinload(FilmCredit.film))
            .where(FilmCredit.person_id == person_id)
            .order_by(FilmCredit.credit_order.asc().nulls_last())
        )
        return list(result.scalars().all())
