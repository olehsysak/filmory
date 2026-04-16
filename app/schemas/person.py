from pydantic import BaseModel, ConfigDict, Field
from datetime import date


class PersonResponse(BaseModel):
    """Schema for person detail page."""
    id: int = Field(..., description="Internal person ID")
    tmdb_id: int = Field(..., description="Person TMDB ID")
    name: str = Field(..., description="Person name")
    biography: str | None = Field(None, description="Person biography")
    birthday: date | None = Field(None, description="Birthday")
    place_of_birth: str | None = Field(None, description="Place of birth")
    profile_url: str | None = Field(None, description="Full profile image URL")

    model_config = ConfigDict(from_attributes=True)


class PersonFilmResponse(BaseModel):
    """Schema for a film on person's page."""
    tmdb_id: int = Field(..., description="Film TMDB ID")
    title: str = Field(..., description="Film title")
    poster_url: str | None = Field(None, description="Full poster URL")
    release_date: date | None = Field(None, description="Release date")
    vote_average: float = Field(0.0, ge=0.0, le=10.0, description="TMDB rating")
    job: str = Field(..., description="Role in this film")
    character: str | None = Field(None, description="Character name if actor")
    genres: list[dict] = Field(default_factory=list, description="Film genres")