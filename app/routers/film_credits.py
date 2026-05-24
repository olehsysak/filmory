from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_film_service, get_person_service
from app.schemas.film_credits import FilmCreditsResponse
from app.services.film_service import FilmService
from app.services.person_service import PersonService


router = APIRouter(
    prefix="/film",
    tags=["credits"],
)


@router.get("/{tmdb_id}/credits", response_model=FilmCreditsResponse)
async def get_film_credits(
    tmdb_id: int,
    film_service: FilmService = Depends(get_film_service),
    person_service: PersonService = Depends(get_person_service),
):
    """Get cast and crew for a film by TMDB ID."""
    film = await film_service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")
    credits = await person_service.get_film_credits(film.id, tmdb_id)
    return credits


@router.get("/{tmdb_id}/public-lists")
async def get_film_public_lists(
    tmdb_id: int,
    film_service: FilmService = Depends(get_film_service),
):
    """Returns public lists that contain this film."""
    film = await film_service.film_repo.get_by_tmdb_id(tmdb_id)
    if not film:
        return []
    return await film_service.get_film_public_lists(film.id)