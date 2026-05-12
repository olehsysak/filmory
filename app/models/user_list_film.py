from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user_list import UserList
    from app.models.film import Film


class UserListFilm(Base):
    __tablename__ = "user_list_films"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    list_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_lists.id", ondelete="CASCADE"), nullable=False)
    film_id: Mapped[int] = mapped_column(Integer, ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("list_id", "film_id", name="uq_list_film"),
    )

    user_list: Mapped["UserList"] = relationship("UserList", back_populates="list_films")
    film: Mapped["Film"] = relationship("Film")