from fastapi import APIRouter, Query, Depends
from app.dependencies import get_search_services
from app.schemas.search import SearchResults
from app.services.film_service import FilmService
from app.services.person_service import PersonService
import asyncio

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query("all", pattern="^(all|film|person)$"),
    limit: int = Query(20, ge=1, le=50),
    services: tuple[FilmService, PersonService] = Depends(get_search_services),
):
    """Global search endpoint for films and persons."""
    film_service, person_service = services

    match type:
        case "film":
            film_limit, person_limit = limit, 0
        case "person":
            film_limit, person_limit = 0, limit
        case _:  # all
            film_limit, person_limit = 5, 3

    tasks = [
        film_service.search(q, limit=film_limit) if film_limit > 0 else asyncio.sleep(0, result=[]),
        person_service.search(q, limit=person_limit) if person_limit > 0 else asyncio.sleep(0, result=[]),
    ]

    films, persons = await asyncio.gather(*tasks)
    return SearchResults(films=films, persons=persons)