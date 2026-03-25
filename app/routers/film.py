from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.dependencies import get_film_service
from app.schemas import FilmResponse, FilmShort
from app.services.film_service import FilmService


router = APIRouter(
    prefix="/film",
    tags=["film"],
)


@router.get("/popular", response_model=list[FilmResponse])
async def get_film_popular(service: FilmService = Depends(get_film_service)):
    """Get film popular by TMDB ID."""
    films = await service.get_popular()
    return films


@router.get("/top-rated", response_model=list[FilmShort])
async def get_top_rated(service: FilmService = Depends(get_film_service)):
    """Get top rated films."""
    films = await service.get_top_rated()
    return films


@router.get("/upcoming", response_model=list[FilmShort])
async def get_upcoming(service: FilmService = Depends(get_film_service)):
    """Get upcoming films."""
    films = await service.get_top_upcoming()
    return films


@router.get("/new", response_model=list[FilmShort])
async def get_new(service: FilmService = Depends(get_film_service)):
    """Get newest films sorted by release date."""
    films = await service.get_new()
    return films


@router.get("/search", response_model=list[FilmShort])
async def search_films(query: str = Query(..., min_length=1), service: FilmService = Depends(get_film_service)):
    """Search films by title."""
    films = await service.search(query)
    return films


@router.get("/{tmdb_id}", response_model=FilmResponse)
async def get_film(tmdb_id: int, service: FilmService = Depends(get_film_service)):
    """Get film by TMDB ID, fetch from TMDB if not in DB."""
    film = await service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")
    return film
