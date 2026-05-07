from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from app.models.user_film import WatchStatus
from app.schemas.film import FilmShort


class UserFilmResponse(BaseModel):
    """Schema for user-film response."""
    id: int = Field(..., description="Internal user-film ID")
    status: WatchStatus = Field(..., description="Watch status")
    rating: int | None = Field(None, ge=1, le=10, description="User rating 1-10")
    film: FilmShort = Field(..., description="Film details")
    added_at: datetime = Field(..., description="When film was added to list")
    watched_at: datetime | None = Field(None, description="When film was marked as completed")

    model_config = ConfigDict(from_attributes=True)


class UserFilmStatusUpdate(BaseModel):
    """Schema for updating watch status."""
    status: WatchStatus = Field(..., description="New watch status")


class UserFilmRatingUpdate(BaseModel):
    """Schema for updating rating."""
    rating: int = Field(..., ge=1, le=10, description="User rating 1-10")
