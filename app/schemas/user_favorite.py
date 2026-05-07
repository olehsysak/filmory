from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from app.schemas.film import FilmShort


class UserFavoriteResponse(BaseModel):
    """Schema for user-favorite response."""
    id: int = Field(..., description="Internal favorite ID")
    film: FilmShort = Field(..., description="Film details")
    added_at: datetime = Field(..., description="Time when film was added to favorites")

    model_config = ConfigDict(from_attributes=True)


class UserFavoriteStateResponse(BaseModel):
    """Schema for user-favorite state response."""
    is_favorite: bool = Field(..., description="Is film in favorites")

    model_config = ConfigDict(from_attributes=False)