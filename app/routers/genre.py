from fastapi import APIRouter, Depends
from app.dependencies import get_genre_service
from app.schemas.genre import GenreResponse
from app.services.genre_service import GenreService


router = APIRouter(
    prefix="/genres",
    tags=["genres"],
)


@router.get("/", response_model=list[GenreResponse])
async def get_all_genres(service: GenreService = Depends(get_genre_service)):
    """Get all genres."""
    return await service.get_all()