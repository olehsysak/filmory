from pydantic import BaseModel, ConfigDict, Field


class GenreResponse(BaseModel):
    """Schema for genre response."""
    id: int = Field(..., description="Internal genre ID")
    tmdb_id: int = Field(..., description="TMDB genre ID")
    name: str = Field(..., description="Genre name")

    model_config = ConfigDict(from_attributes=True)