from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.film import Film
    from app.models.user_list_film import UserListFilm


class UserList(Base):
    """"""
    __tablename__ = "user_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cover_film_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("films.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="lists")
    cover_film: Mapped["Film | None"] = relationship("Film", foreign_keys=[cover_film_id])
    list_films: Mapped[list["UserListFilm"]] = relationship(
        "UserListFilm",
        back_populates="user_list",
        cascade="all, delete-orphan",
        order_by="UserListFilm.position",
    )