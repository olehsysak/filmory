from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class UserListCreate(BaseModel):
    """Schema for creating a user list."""
    name: str = Field(..., min_length=1, max_length=255, description="List name")
    description: str | None = Field(None, description="Optional description")
    is_public: bool = Field(False, description="Public visibility")


class UserListUpdate(BaseModel):
    """Schema for updating a user list."""
    name: str | None = Field(None, min_length=1, max_length=255, description="List name")
    description: str | None = Field(None, description="Optional description")
    is_public: bool | None = Field(None, description="Public visibility")
    cover_film_id: int | None = Field(None, description="Internal film ID to use as cover")


class UserListResponse(BaseModel):
    """Schema for user list response (in catalog/collection)."""
    id: int = Field(..., description="List ID")
    name: str = Field(..., description="List name")
    description: str | None = Field(None, description="Optional description")
    is_public: bool = Field(..., description="Public visibility")
    film_count: int = Field(0, description="Number of films in list")
    cover_url: str | None = Field(None, description="Cover poster URL")
    created_at: datetime = Field(..., description="Creation date")
    updated_at: datetime = Field(..., description="Last update date")

    model_config = ConfigDict(from_attributes=False)


class UserListFilmResponse(BaseModel):
    """Schema for a film inside a list."""
    id: int = Field(..., description="Internal film ID")
    tmdb_id: int = Field(..., description="TMDB film ID")
    title: str = Field(..., description="Film title")
    poster_url: str | None = Field(None, description="Poster URL")
    release_date: datetime | None = Field(None, description="Release date")
    vote_average: float = Field(0.0, description="TMDB rating")
    overview: str | None = Field(None, description="Film overview")
    added_at: datetime = Field(..., description="When film was added to list")
    position: int = Field(..., description="Position in list")

    model_config = ConfigDict(from_attributes=False)


class FilmMembershipItem(BaseModel):
    """Single list entry for the 'add to list' modal."""
    id: int
    name: str
    is_public: bool
    film_count: int
    cover_url: str | None
    has_film: bool = Field(..., description="True if this list already contains the film")

    model_config = ConfigDict(from_attributes=False)


class FilmMembershipResponse(BaseModel):
    """Response for the 'add to list' modal."""
    lists: list[FilmMembershipItem]

    model_config = ConfigDict(from_attributes=False)