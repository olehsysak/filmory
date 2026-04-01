from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

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