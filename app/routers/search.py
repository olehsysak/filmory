from fastapi import APIRouter, Query, Depends
from app.dependencies import get_search_services
from app.schemas.search import SearchResults, MixedResult, PersonShort
from app.schemas.film import FilmShort
from app.services.film_service import FilmService
from app.services.person_service import PersonService
from app.clients.tmdb_client import tmdb_client


router = APIRouter(
    prefix="/search",
    tags=["search"]
)


async def _parse_multi_results(items: list, film_service: FilmService, limit: int) -> list[MixedResult]:
    """
    Parse TMDB multi-search results and convert them into internal Film/Person models.
    Creates DB records for new films if needed.
    """
    results = []

    for item in items:
        if len(results) >= limit:
            break

        media_type = item.get("media_type")

        # Determine if result is a movie or a person
        if media_type == "movie":
            film = await film_service.film_repo.get_by_tmdb_id(item["id"])
            if not film:
                film_data = film_service._parse_film_data(item)
                film = await film_service.film_repo.create(film_data)
                await film_service._attach_genres_from_ids(film, item.get("genre_ids", []))
            film_service._set_poster_urls([film])
            results.append(MixedResult(
                type="film",
                film=FilmShort(
                    id=film.id,
                    tmdb_id=film.tmdb_id,
                    title=film.title,
                    poster_url=film.poster_url,
                    release_date=film.release_date,
                    vote_average=film.vote_average,
                    runtime=film.runtime,
                    overview=film.overview,
                )
            ))

        elif media_type == "person":
            known_for_list = item.get("known_for", [])
            top_film = None
            if known_for_list:
                top_film = known_for_list[0].get("title") or known_for_list[0].get("name")

            results.append(MixedResult(
                type="person",
                person=PersonShort(
                    tmdb_id=item["id"],
                    name=item["name"],
                    profile_url=tmdb_client.get_image_url(
                        item.get("profile_path"), size="w185"
                    ) if item.get("profile_path") else None,
                    known_for=item.get("known_for_department"),
                    top_film=top_film,
                )
            ))

    return results


@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query("all", pattern="^(all|film|person)$"),
    limit: int = Query(20, ge=1, le=50),
    page: int = Query(1, ge=1),
    services: tuple[FilmService, PersonService] = Depends(get_search_services),
):
    """
    Search films and persons using TMDB and internal services.
    Supports mixed, film-only, and person-only search modes.
    """
    film_service, person_service = services

    if type == "all":
        results = []
        current_page = page
        max_pages = 5

        while len(results) < limit and current_page <= max_pages:
            tmdb_data = await tmdb_client.search_multi(q, page=current_page)
            items = tmdb_data.get("results", [])
            if not items:
                break

            batch = await _parse_multi_results(items, film_service, limit - len(results))
            results.extend(batch)
            current_page += 1

            total_pages = tmdb_data.get("total_pages", 1)
            if current_page > total_pages:
                break

    elif type == "film":
        films = await film_service.search(q, limit=limit, page=page)
        return SearchResults(films=films)

    elif type == "person":
        persons = await person_service.search(q, limit=limit, page=page)
        return SearchResults(persons=persons)

    await film_service.db.commit()
    return SearchResults(mixed=results, next_page=current_page)