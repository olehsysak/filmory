from sqlalchemy import Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from app.models.user_film import UserFilm
    from app.models.user_favorite import UserFavorite
    from app.models.user_list import UserList


class User(Base):
    """User account model."""
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String(20), default='user', nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default = func.now(), default=func.now())

    films: Mapped[list["UserFilm"]] = relationship(
        "UserFilm", back_populates="user", cascade="all, delete-orphan"
    )
    favorites: Mapped[list["UserFavorite"]] = relationship(
        "UserFavorite", back_populates="user", cascade="all, delete-orphan"
    )
    lists: Mapped[list["UserList"]] = relationship(
        "UserList", back_populates="user", cascade="all, delete-orphan"
    )