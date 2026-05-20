import os
import uuid
from fastapi import HTTPException, status, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.profile_repo import ProfileRepository
from app.models.user import User
from app.clients.tmdb_client import tmdb_client
from app.utils.password import verify_password, hash_password

AVATAR_DIR = "app/static/uploads/avatars"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB

PINNED_FILMS_MAX = 5
PINNED_LISTS_MAX = 6


class ProfileService:
    """Service layer for profile business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProfileRepository(db)


    async def get_profile(self, username: str, viewer_id: int | None) -> dict:
        """Get full profile view for a user."""
        user = await self.repo.get_by_username(username)

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Check if requesting user is the owner of the profile
        is_owner = viewer_id is not None and viewer_id == user.id

        profile = {
            "id": user.id,
            "username": user.username,
            "bio": user.bio,
            "avatar_url": self._avatar_url(user.avatar_path),
            "created_at": user.created_at,
            "is_owner": is_owner,

            # Privacy settings (used by frontend to decide what to show)
            "want_to_watch_public": user.want_to_watch_public,
            "watching_public": user.watching_public,
            "completed_public": user.completed_public,
            "dropped_public": user.dropped_public,
            "favorites_public": user.favorites_public,
            "lists_public": user.lists_public,
            "activity_public": user.activity_public,
        }

        # Stats — always visible
        stats = await self.repo.get_stats(user.id)
        profile["stats"] = stats

        # Top genres (based on completed films)
        profile["top_genres"] = await self.repo.get_top_genres(user.id)

        # Rating distribution (for histogram UI)
        dist = stats["rating_distribution"]
        profile["rating_distribution"] = dist
        profile["rating_max"] = max(dist.values()) if any(dist.values()) else 1

        # Pinned films
        pinned_films = await self.repo.get_pinned_films(user.pinned_film_ids or [])
        profile["pinned_films"] = [self._serialize_film(f) for f in pinned_films]
        profile["pinned_films_max"] = PINNED_FILMS_MAX

        # Pinned lists — visitors only see public lists
        pinned_lists = await self.repo.get_pinned_lists(
            user.pinned_list_ids or [],
            viewer_id=viewer_id if is_owner else None,
        )
        profile["pinned_lists"] = [self._serialize_list(lst) for lst in pinned_lists]
        profile["pinned_lists_max"] = PINNED_LISTS_MAX

        # Activity
        if is_owner or user.activity_public:
            activity = await self.repo.get_recent_activity(user.id, limit=10)

            # Attach poster URLs for frontend convenience
            for item in activity:
                item["film_poster_url"] = (
                    tmdb_client.get_image_url(item["film_poster_path"], size="w92")
                    if item.get("film_poster_path") else None
                )
            profile["activity"] = activity
        else:
            profile["activity"] = None

        return profile


    async def update_basic(self, user_id: int, username: str | None, bio: str | None) -> User:
        """Update basic user profile fields (username, bio)."""
        user = await self._get_or_404(user_id)

        # Username uniqueness check
        if username and username != user.username:
            existing = await self.repo.get_by_username(username)
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

        fields = {}
        if username is not None:
            fields["username"] = username
        if bio is not None:
            fields["bio"] = bio

        return await self.repo.update(user, **fields)


    async def update_password(self, user_id: int, current_password: str, new_password: str) -> None:
        """Change user password after verifying current password."""
        user = await self._get_or_404(user_id)

        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

        await self.repo.update(user, hashed_password=hash_password(new_password))


    async def update_privacy(self, user_id: int, **privacy_fields) -> User:
        """Update privacy-related flags."""
        user = await self._get_or_404(user_id)
        fields = {k: v for k, v in privacy_fields.items() if v is not None}
        return await self.repo.update(user, **fields)


    async def update_pinned(
        self,
        user_id: int,
        pinned_film_ids: list[int] | None,
        pinned_list_ids: list[int] | None,
    ) -> User:
        """Update pinned films and lists."""
        user = await self._get_or_404(user_id)
        fields = {}

        # Validate pinned films limit
        if pinned_film_ids is not None:
            if len(pinned_film_ids) > PINNED_FILMS_MAX:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Maximum {PINNED_FILMS_MAX} pinned films allowed",
                )
            fields["pinned_film_ids"] = pinned_film_ids

        # Validate pinned lists limit
        if pinned_list_ids is not None:
            if len(pinned_list_ids) > PINNED_LISTS_MAX:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Maximum {PINNED_LISTS_MAX} pinned lists allowed",
                )
            fields["pinned_list_ids"] = pinned_list_ids

        return await self.repo.update(user, **fields)


    async def upload_avatar(self, user_id: int, file: UploadFile) -> User:
        """Upload user avatar."""
        user = await self._get_or_404(user_id)

        ext = os.path.splitext(file.filename or "")[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        contents = await file.read()

        if len(contents) > MAX_AVATAR_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large. Maximum 5MB")

        # Remove old avatar if exists
        if user.avatar_path:
            old_path = os.path.join(AVATAR_DIR, user.avatar_path)
            if os.path.exists(old_path):
                os.remove(old_path)

        # Save new avatar
        filename = f"{uuid.uuid4().hex}{ext}"
        os.makedirs(AVATAR_DIR, exist_ok=True)

        with open(os.path.join(AVATAR_DIR, filename), "wb") as f:
            f.write(contents)

        return await self.repo.update(user, avatar_path=filename)


    async def _get_or_404(self, user_id: int) -> User:
        """Fetch user or raise 404."""
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        return user


    def _avatar_url(self, avatar_path: str | None) -> str | None:
        """Build public avatar URL."""
        return f"/static/uploads/avatars/{avatar_path}" if avatar_path else None


    def _serialize_film(self, film) -> dict:
        """Convert Film ORM model to API-ready dict."""
        return {
            "id": film.id,
            "tmdb_id": film.tmdb_id,
            "title": film.title,
            "poster_url": tmdb_client.get_image_url(film.poster_path),
        }


    def _serialize_list(self, user_list) -> dict:
        """Convert UserList ORM model to API-ready dict."""
        cover_urls = [
            tmdb_client.get_image_url(p)
            for p in (user_list.cover_poster_paths or [])
            if p
        ]

        return {
            "id": user_list.id,
            "name": user_list.name,
            "description": user_list.description,
            "is_public": user_list.is_public,
            "cover_url": cover_urls[0] if cover_urls else None,
            "cover_urls": cover_urls,
            "cover_film_ids": user_list.cover_film_ids or [],
        }