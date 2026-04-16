from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_person_service
from app.schemas.person import PersonResponse, PersonFilmResponse
from app.services.person_service import PersonService


router = APIRouter(
    prefix="/person",
    tags=["person"],
)


@router.get("/{tmdb_id}", response_model=PersonResponse)
async def get_person(
    tmdb_id: int,
    service: PersonService = Depends(get_person_service),
):
    """Get person detail by TMDB ID."""
    person = await service.get_person_detail(tmdb_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


@router.get("/{tmdb_id}/films", response_model=list[PersonFilmResponse])
async def get_person_films(
    tmdb_id: int,
    service: PersonService = Depends(get_person_service),
):
    """Get all films for a person by TMDB ID."""
    person = await service.get_person_detail(tmdb_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    films = await service.get_person_films(person["id"], tmdb_id)
    return films