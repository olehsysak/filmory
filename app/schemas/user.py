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
    """Schema for user response."""
    id: int = Field(..., description="User ID")
    username: str = Field(..., description="User name")
    email: EmailStr = Field(..., description="Email address")
    is_active: bool = Field(..., description="Is active")
    role: str = Field(..., description="User role (user/admin)")
    created_at: datetime = Field(..., description="Created at")

    model_config = ConfigDict(from_attributes=True)