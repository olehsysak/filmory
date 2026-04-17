from pydantic import BaseModel, Field


class CastMemberResponse(BaseModel):
    """Schema for a cast member in a film."""
    tmdb_id: int = Field(..., description="Person TMDB ID")
    name: str = Field(..., description="Person name")
    profile_url: str | None = Field(None, description="Full profile image URL")
    character: str | None = Field(None, description="Character name")
    order: int | None = Field(None, description="Cast order")


class CrewMemberResponse(BaseModel):
    """Schema for a crew member in a film."""
    tmdb_id: int = Field(..., description="Person TMDB ID")
    name: str = Field(..., description="Person name")
    profile_url: str | None = Field(None, description="Full profile image URL")
    job: str = Field(..., description="Job title")
    department: str = Field(..., description="Department")
    is_key: bool = Field(False, description="Whether this is a key crew role")


class FilmCreditsResponse(BaseModel):
    """Schema for full film credits (cast + crew)."""
    cast: list[CastMemberResponse] = Field(default_factory=list)
    crew: list[CrewMemberResponse] = Field(default_factory=list)