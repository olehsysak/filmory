from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_search_services, get_async_db
from app.schemas.search import SearchResults, MixedResult, PersonShort, MemberShort, ListShort
from app.schemas.film import FilmShort
from app.services.film_service import FilmService
from app.services.person_service import PersonService
from app.repositories.profile_repo import ProfileRepository
from app.repositories.user_list_repo import UserListRepository
from app.clients.tmdb_client import tmdb_client


router = APIRouter(
    prefix="/search",
    tags=["search"]
)


async def _parse_multi_results(items: list, film_service: FilmService, limit: int) -> list[MixedResult]:
    """Parse TMDB multi-search results and convert them into internal Film/Person models."""
    results = []

    for item in items:

        # Stop once the requested limit is reached
        if len(results) >= limit:
            break

        media_type = item.get("media_type")

        # Movie results
        if media_type == "movie":

            film = await film_service.film_repo.get_by_tmdb_id(item["id"])

            # Create and store the film locally if it does not exist yet
            if not film:
                film_data = film_service._parse_film_data(item)
                film = await film_service.film_repo.create(film_data)
                await film_service._attach_genres_from_ids(film, item.get("genre_ids", []))

            # Generate full poster URLs
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

        # Person results
        elif media_type == "person":

            known_for_list = item.get("known_for", [])
            top_film = known_for_list[0].get("title") or known_for_list[0].get("name") if known_for_list else None

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


def _serialize_member(user) -> MemberShort:
    """Convert User ORM object to MemberShort schema."""
    return MemberShort(
        id=user.id,
        username=user.username,
        avatar_url=(
            f"/static/uploads/avatars/{user.avatar_path}"
            if user.avatar_path else None
        ),
        bio=user.bio,
    )


def _serialize_list(user_list, author, film_count: int) -> ListShort:
    """Convert UserList + author ORM objects to ListShort schema."""

    # Build full cover image URLs
    cover_urls = [
        tmdb_client.get_image_url(p)
        for p in (user_list.cover_poster_paths or [])
        if p
    ]

    return ListShort(
        id=user_list.id,
        name=user_list.name,
        description=user_list.description,
        cover_url=cover_urls[0] if cover_urls else None,
        cover_urls=cover_urls,
        film_count=film_count,
        likes_count=user_list.likes_count,
        author_username=author.username,
        author_avatar_url=(
            f"/static/uploads/avatars/{author.avatar_path}"
            if author.avatar_path else None
        ),
    )


@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query("all", pattern="^(all|film|person|member|list)$"),
    limit: int = Query(20, ge=1, le=50),
    page: int = Query(1, ge=1),
    services: tuple[FilmService, PersonService] = Depends(get_search_services),
    db: AsyncSession = Depends(get_async_db),
):
    """Search films, persons, members and public lists."""
    film_service, person_service = services

    # Pagination offset for database queries
    offset = (page - 1) * limit

    # Members search
    if type == "member":
        profile_repo = ProfileRepository(db)
        users = await profile_repo.search_users(q, limit=limit, offset=offset)
        return SearchResults(members=[_serialize_member(u) for u in users])

    # Public lists search
    if type == "list":
        list_repo = UserListRepository(db)
        rows = await list_repo.get_public_lists(
            search=q,
            sort="likes_desc",
            limit=limit,
            offset=offset,
        )
        return SearchResults(lists=[_serialize_list(ul, author, fc) for ul, author, fc in rows])

    # Films only
    if type == "film":
        films = await film_service.search(q, limit=limit, page=page)
        return SearchResults(films=films)

    # Persons only
    if type == "person":
        persons = await person_service.search(q, limit=limit, page=page)
        return SearchResults(persons=persons)

    # Mixed search (films + persons)
    results = []

    current_page = page
    max_pages = 5

    while len(results) < limit and current_page <= max_pages:

        # Fetch one TMDB multi-search page
        tmdb_data = await tmdb_client.search_multi(q, page=current_page)
        items = tmdb_data.get("results", [])

        if not items:
            break

        # Convert TMDB results into internal schemas
        batch = await _parse_multi_results(items, film_service, limit - len(results))

        results.extend(batch)
        current_page += 1

        # Stop if the last TMDB page is reached
        if current_page > tmdb_data.get("total_pages", 1):
            break

    await film_service.db.commit()
    return SearchResults(mixed=results, next_page=current_page)