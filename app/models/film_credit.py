from sqlalchemy import Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.film import Film
    from app.models.person import Person


class FilmCredit(Base):
    """FilmCredit Model — links Films and Persons with their role (cast or crew)."""
    __tablename__ = 'film_credits'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    film_id: Mapped[int] = mapped_column(Integer, ForeignKey('films.id', ondelete='CASCADE'), nullable=False)
    person_id: Mapped[int] = mapped_column(Integer, ForeignKey('persons.id', ondelete='CASCADE'), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    job: Mapped[str] = mapped_column(String(100), nullable=False)
    character: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credit_order: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint('film_id', 'person_id', 'job', name='uq_film_person_job'),
    )

    film: Mapped["Film"] = relationship("Film", back_populates="credits")
    person: Mapped["Person"] = relationship("Person", back_populates="credits")