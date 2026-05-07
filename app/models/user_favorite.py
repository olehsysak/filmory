from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.film import Film


class UserFavorite(Base):
    """User favorite films — independent from watchlist."""
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "film_id", name="uq_user_favorite"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    film_id: Mapped[int] = mapped_column(Integer, ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="favorites")
    film: Mapped["Film"] = relationship("Film", back_populates="favorited_by")