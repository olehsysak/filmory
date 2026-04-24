from pydantic import BaseModel, ConfigDict, Field
from app.schemas.film import FilmShort


class PersonShort(BaseModel):
    """Minimal person info for search results."""
    tmdb_id: int = Field(..., description="TMDB ID")
    name: str = Field(..., description="Name of person")
    profile_url: str | None = Field(None, description="Profile URL from TMDB")
    known_for: str | None = Field(None, description="Person's job")

    model_config = ConfigDict(from_attributes=True)


class SearchResults(BaseModel):
    """Unified search response."""
    films: list[FilmShort]
    persons: list[PersonShort]