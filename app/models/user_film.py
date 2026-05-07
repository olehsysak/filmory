import enum
from sqlalchemy import Integer, DateTime, ForeignKey, Enum, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from app.models.user import User
    from app.models.film import Film


class WatchStatus(str, enum.Enum):
    want_to_watch = "want_to_watch"
    watching = "watching"
    completed = "completed"
    dropped = "dropped"


class UserFilm(Base):
    """User film relationship: watchlist, and ratings"""
    __tablename__ = "user_films"
    __table_args__ = (
        UniqueConstraint("user_id", "film_id", name="uq_user_film"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    film_id: Mapped[int] = mapped_column(Integer, ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[WatchStatus] = mapped_column(Enum(WatchStatus), nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    watched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="films")
    film: Mapped["Film"] = relationship("Film", back_populates="user_entries")