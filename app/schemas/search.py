# app/schemas/search.py

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


class MemberShort(BaseModel):
    """Minimal user info for member search results."""
    id: int = Field(..., description="Internal user ID")
    username: str = Field(..., description="Username")
    avatar_url: str | None = Field(None, description="Avatar URL")
    bio: str | None = Field(None, description="User bio")

    model_config = ConfigDict(from_attributes=False)


class ListShort(BaseModel):
    """Minimal list info for list search results."""
    id: int = Field(..., description="List ID")
    name: str = Field(..., description="List name")
    description: str | None = Field(None, description="List description")
    cover_url: str | None = Field(None, description="Primary cover poster URL")
    cover_urls: list[str] = Field(default_factory=list, description="Cover poster URLs")
    film_count: int = Field(0, description="Number of films in list")
    likes_count: int = Field(0, description="Number of likes")
    author_username: str = Field(..., description="Owner's username")
    author_avatar_url: str | None = Field(None, description="Owner's avatar URL")

    model_config = ConfigDict(from_attributes=False)


class MixedResult(BaseModel):
    """Single item in mixed search results — either a film or a person."""
    type: Literal["film", "person"] = Field(..., description="Type of result")
    film: FilmShort | None = Field(None, description="Film data")
    person: PersonShort | None = Field(None, description="Person data")


class SearchResults(BaseModel):
    """Unified search response."""
    films: list[FilmShort] = Field(default_factory=list, description="List of films in list")
    persons: list[PersonShort] = Field(default_factory=list, description="List of persons in list")
    mixed: list[MixedResult] = Field(default_factory=list, description="List of mixed results in list (films and persons)")
    members: list[MemberShort] = Field(default_factory=list, description="List of members in list")
    lists: list[ListShort] = Field(default_factory=list, description="List of lists in list")
    next_page: int = Field(default=1, description="Page number")