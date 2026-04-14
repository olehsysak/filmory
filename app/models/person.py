from sqlalchemy import Integer, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from app.database import Base
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from app.models.film_credit import FilmCredit


class Person(Base):
    """Personal Model - actors, directors, and other crew members."""
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    profile_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    place_of_birth: Mapped[str | None] = mapped_column(String(255), nullable=True)

    credits: Mapped[list["FilmCredit"]] = relationship(
        "FilmCredit", back_populates="person"
    )