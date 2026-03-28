from sqlalchemy import Integer, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.schema import ForeignKey

from app.database import Base
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from app.models.film import Film


class Genre(Base):
    """Model for films genres."""
    __tablename__ = 'genres'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    films: Mapped[list["Film"]] = relationship(
        "Film", secondary="film_genre", back_populates="genres"
    )


# Intermediate table for a many-to-many relationship between movies and genres.
film_genre = Table(
    "film_genre", Base.metadata,
    Column("film_id", Integer, ForeignKey("films.id"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id"), primary_key=True),
)