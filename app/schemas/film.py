from pydantic import BaseModel, ConfigDict, Field
from datetime import date
from app.schemas.genre import GenreResponse


class FilmBase(BaseModel):
    """Base film schema."""
    tmdb_id: int = Field(..., description="TMDB film ID")
    title: str = Field(..., description="Film title")
    overview: str | None = Field(None, description="Film overview")
    tagline: str | None = Field(None, description="Film tagline")
    poster_path: str | None = Field(None, description="Poster path from TMDB")
    release_date: date | None = Field(None, description="Release date")
    vote_average: float = Field(0.0, ge=0.0, le=10.0, description="TMDB rating")
    vote_count: int = Field(0, ge=0, description="Number of votes")
    popularity: float = Field(0.0, ge=0.0, description="Popularity score")
    runtime: int | None = Field(None, ge=0, description="Runtime in minutes")


class FilmCreate(FilmBase):
    """Schema for creating a film."""
    pass


class FilmResponse(FilmBase):
    """Schema for film response."""
    id: int = Field(..., description="Internal film ID")
    poster_url: str | None = Field(None, description="Full poster URL")
    genres: list[GenreResponse] = Field(default_factory=list, description="Film genres")

    model_config = ConfigDict(from_attributes=True)


class FilmShort(BaseModel):
    """Short film schema for catalog listing."""
    id: int = Field(..., description="Internal film ID")
    tmdb_id: int = Field(..., description="TMDB film ID")
    title: str = Field(..., description="Film title")
    poster_url: str | None = Field(None, description="Full poster URL")
    release_date: date | None = Field(None, description="Release date")
    vote_average: float = Field(0.0, ge=0.0, le=10.0, description="TMDB rating")

    model_config = ConfigDict(from_attributes=True)