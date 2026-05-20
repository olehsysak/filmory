from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.user_list import UserList


class UserListLike(Base):
    """User likes for public lists."""
    __tablename__ = "user_list_likes"
    __table_args__ = (
        UniqueConstraint("user_id", "list_id", name="uq_user_list_like"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    list_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_lists.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User")
    user_list: Mapped["UserList"] = relationship("UserList", back_populates="likes")