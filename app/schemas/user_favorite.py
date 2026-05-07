from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from app.schemas.film import FilmShort


class UserFavoriteResponse(BaseModel):
    id: int = Field(..., description="Internal favorite ID")
    film: FilmShort = Field(..., description="Film details")
    added_at: datetime = Field(..., description="Time when film was added to favorites")

    model_config = ConfigDict(from_attributes=True)