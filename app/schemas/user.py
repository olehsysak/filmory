from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime


class UserRegister(BaseModel):
    """Schema for user registration."""
    username: str = Field(..., min_length=3, max_length=50, description="User name")
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=72, description="User password")


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=72, description="User password")


class UserResponse(BaseModel):
    """Schema for user response (auth endpoints, /me)."""
    id: int = Field(..., description="User ID")
    username: str = Field(..., description="User name")
    email: EmailStr = Field(..., description="Email address")
    is_active: bool = Field(..., description="Is active")
    role: str = Field(..., description="User role (user/admin)")
    created_at: datetime = Field(..., description="Created at")
    avatar_path: str | None = Field(None, description="Avatar file path")

    model_config = ConfigDict(from_attributes=True)


class UserProfileResponse(BaseModel):
    """Schema for public profile page."""
    id: int = Field(..., description="Unique user ID")
    username: str = Field(..., description="Public display name")
    bio: str | None = Field(None, description="Optional short bio")
    avatar_url: str | None = Field(None, description="URL to the user's avatar image")
    created_at: datetime = Field(..., description="Date the user joined the platform")

    # Privacy flags — used by frontend to decide which tabs to show
    want_to_watch_public: bool = Field(True, description="Whether 'Want to watch' list is visible to others")
    watching_public: bool = Field(True, description="Whether 'Watching' list is visible to others")
    completed_public: bool = Field(True, description="Whether 'Completed' list is visible to others")
    dropped_public: bool = Field(True, description="Whether 'Dropped' list is visible to others")
    favorites_public: bool = Field(True, description="Whether favorites are visible to others")
    lists_public: bool = Field(True, description="Whether custom lists are visible to others")
    liked_lists_public: bool = Field(True, description="Whether liked lists are visible to others")
    activity_public: bool = Field(True, description="Whether activity feed is visible to others")

    model_config = ConfigDict(from_attributes=False)


class UserStatsResponse(BaseModel):
    """Schema for profile stats block."""
    want_to_watch: int = Field(0, description="Number of films in 'Want to watch' list")
    watching: int = Field(0, description="Number of films currently being watched")
    films_seen: int = Field(0, description="Total number of completed films")
    dropped: int = Field(0, description="Number of films dropped")
    this_year: int = Field(0, description="Number of films completed in the current year")
    hours_watched: int = Field(0, description="Total watch time in full hours")
    minutes_watched: int = Field(0, description="Remaining minutes beyond full hours")
    avg_rating: float | None = Field(None, description="Average rating given by the user (1.0–10.0)")
    rated_count: int = Field(0, description="Number of films the user has rated")
    favorites_count: int = Field(0, description="Number of films marked as favorites")
    public_lists_count: int = Field(0, description="Number of publicly visible custom lists")
    private_lists_count: int = Field(0, description="Number of private custom lists")
    total_lists_count: int = Field(0, description="Total number of custom lists (public + private)")
    liked_lists_count: int = Field(0, description="Total number of liked lists")

    model_config = ConfigDict(from_attributes=False)


class UserProfileUpdate(BaseModel):
    """Schema for updating profile basic info."""
    username: str | None = Field(None, min_length=3, max_length=50, description="New display name")
    bio: str | None = Field(None, max_length=1000, description="Updated bio")


class UserPasswordUpdate(BaseModel):
    """Schema for changing password."""
    current_password: str = Field(..., min_length=8, max_length=72, description="Current account password for verification")
    new_password: str = Field(..., min_length=8, max_length=72, description="New password to replace the current one")


class UserPrivacyUpdate(BaseModel):
    """Schema for updating privacy settings."""
    want_to_watch_public: bool | None = Field(None, description="Set visibility of 'Want to watch' list")
    watching_public: bool | None = Field(None, description="Set visibility of 'Watching' list")
    completed_public: bool | None = Field(None, description="Set visibility of 'Completed' list")
    dropped_public: bool | None = Field(None, description="Set visibility of 'Dropped' list")
    favorites_public: bool | None = Field(None, description="Set visibility of favorites")
    lists_public: bool | None = Field(None, description="Set visibility of custom lists")
    liked_lists_public: bool | None = Field(None, description="Set visibility of liked lists tab")
    activity_public: bool | None = Field(None, description="Set visibility of activity feed")


class UserPinnedUpdate(BaseModel):
    """Schema for updating pinned films and lists."""
    pinned_film_ids: list[int] | None = Field(None, max_length=5, description="Up to 5 film IDs to pin on the profile")
    pinned_list_ids: list[int] | None = Field(None, max_length=6, description="Up to 6 list IDs to pin on the profile")