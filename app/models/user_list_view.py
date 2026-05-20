from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.database import Base


class UserListView(Base):
    """Tracks unique list views per user (for authenticated users)."""
    __tablename__ = "user_list_views"
    __table_args__ = (
        UniqueConstraint("user_id", "list_id", name="uq_user_list_view"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    list_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user_lists.id", ondelete="CASCADE"), nullable=False
    )
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )