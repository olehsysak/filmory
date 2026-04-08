from fastapi import APIRouter, Request, Depends, status, HTTPException
from app.templates import templates
from app.services.film_service import FilmService
from app.dependencies import get_film_service


router = APIRouter(tags=["pages"])


@router.get("/")
async def index(request: Request, service: FilmService = Depends(get_film_service)):
    popular = await service.get_popular()
    coming_soon = await service.get_top_upcoming()
    return templates.TemplateResponse("index.html", {
        "request": request,
        "popular": popular,
        "coming_soon": coming_soon,
    })


@router.get("/film/{tmdb_id}")
async def film_detail(request: Request, tmdb_id: int, service: FilmService = Depends(get_film_service)):
    film = await service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")
    return templates.TemplateResponse("film.html", {
        "request": request,
        "film": film,
    })