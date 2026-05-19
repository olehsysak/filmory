from fastapi import APIRouter, Depends, Request, UploadFile, File, status
from app.dependencies import get_current_user, get_profile_service
from app.services.profile_service import ProfileService
from app.schemas.user import (
    UserProfileUpdate,
    UserPasswordUpdate,
    UserPrivacyUpdate,
    UserPinnedUpdate,
)
from app.models.user import User


router = APIRouter(
    prefix="/profile",
    tags=["profile"],
)


users_router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@users_router.get("/{username}")
async def get_user_profile(
    username: str,
    request: Request,
    service: ProfileService = Depends(get_profile_service),
):
    """Get public profile data for any user by username."""
    viewer = request.state.user
    viewer_id = viewer.id if viewer else None
    return await service.get_profile(username, viewer_id)


@router.patch("/basic")
async def update_basic(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Update username and/or bio."""
    user = await service.update_basic(
        current_user.id,
        username=data.username,
        bio=data.bio,
    )
    return {"username": user.username, "bio": user.bio}


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_password(
    data: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Change password."""
    await service.update_password(
        current_user.id,
        current_password=data.current_password,
        new_password=data.new_password,
    )


@router.patch("/privacy")
async def update_privacy(
    data: UserPrivacyUpdate,
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Update privacy settings."""
    user = await service.update_privacy(
        current_user.id,
        want_to_watch_public=data.want_to_watch_public,
        watching_public=data.watching_public,
        completed_public=data.completed_public,
        dropped_public=data.dropped_public,
        favorites_public=data.favorites_public,
        lists_public=data.lists_public,
        activity_public=data.activity_public,
    )
    return {
        "want_to_watch_public": user.want_to_watch_public,
        "watching_public": user.watching_public,
        "completed_public": user.completed_public,
        "dropped_public": user.dropped_public,
        "favorites_public": user.favorites_public,
        "lists_public": user.lists_public,
        "activity_public": user.activity_public,
    }


@router.patch("/pinned")
async def update_pinned(
    data: UserPinnedUpdate,
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Update pinned films and/or lists."""
    user = await service.update_pinned(
        current_user.id,
        pinned_film_ids=data.pinned_film_ids,
        pinned_list_ids=data.pinned_list_ids,
    )
    return {
        "pinned_film_ids": user.pinned_film_ids,
        "pinned_list_ids": user.pinned_list_ids,
    }


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Upload avatar image."""
    user = await service.upload_avatar(current_user.id, file)
    return {"avatar_url": f"/static/uploads/avatars/{user.avatar_path}"}