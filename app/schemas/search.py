from pydantic import BaseModel, ConfigDict, Field
from app.schemas.film import FilmShort
from typing import Literal


class PersonShort(BaseModel):
    """Minimal person info for search results."""
    tmdb_id: int = Field(..., description="TMDB ID")
    name: str = Field(..., description="Name of person")
    profile_url: str | None = Field(None, description="Profile URL from TMDB")
    known_for: str | None = Field(None, description="Person's job")
    top_film: str | None = Field(None, description="Top person's film")

    model_config = ConfigDict(from_attributes=True)


class MixedResult(BaseModel):
    """Single item in mixed search results — either a film or a person."""
    type: Literal["film", "person"] = Field(..., description="Type of result")
    film: FilmShort | None = Field(None, description="Film data")
    person: PersonShort | None = Field(None, description="Person data")


class SearchResults(BaseModel):
    """Unified search response."""
    films: list[FilmShort] = Field(default_factory=list, description="List of films")
    persons: list[PersonShort] = Field(default_factory=list, description="List of persons")
    mixed: list[MixedResult] = Field(default_factory=list, description="Combined results")
    next_page: int = Field(default=1, description="Next page")