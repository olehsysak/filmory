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


@router.get("/catalog")
async def get_catalog(
    sort: str = "popular",
    genre_id: int | None = None,
    year: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    upcoming: bool = False,
    trending_period: str | None = None,
    runtime_min: int | None = None,
    runtime_max: int | None = None,
    page: int = 1,
    service: FilmService = Depends(get_film_service),
):
    films, total, total_pages = await service.get_catalog(
        sort=sort, genre_id=genre_id, year=year,
        year_from=year_from, year_to=year_to,
        upcoming=upcoming, trending_period=trending_period,
        runtime_min=runtime_min, runtime_max=runtime_max,
        page=page,
    )
    return {
        "films": [FilmShort.model_validate(f) for f in films],
        "total": total, "page": page, "pages": total_pages,
    }


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


@router.get("/", response_model=list[FilmShort])
async def get_films_by_genre(
    genre_id: int = Query(..., description="Internal genre ID"),
    service: FilmService = Depends(get_film_service)
):
    """Get films filtered by genre."""
    films = await service.get_by_genre(genre_id)
    if not films:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No films found for this genre")
    return films