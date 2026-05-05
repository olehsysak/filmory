from sqlalchemy.ext.asyncio import AsyncSession
from app.cache.redis_cache import redis_cache
from app.cache.ttl import TTL
from app.repositories.film_repo import FilmRepository
from app.repositories.person_repo import PersonRepository
from app.repositories.film_credit_repo import FilmCreditRepository
from app.clients.tmdb_client import tmdb_client
from datetime import date


KEY_JOBS = {
    "Director", "Co-Director",
    "Producer", "Executive Producer",
    "Screenplay", "Writer", "Novel",
    "Director of Photography",
    "Original Music Composer",
    "Editor",
    "Production Design",
}


class PersonService:
    """Service for cast and crew business logic."""

    def __init__(self, db: AsyncSession, film_service=None):
        self.db = db
        self.person_repo = PersonRepository(db)
        self.credit_repo = FilmCreditRepository(db)
        self.film_repo = FilmRepository(db)
        self.film_service = film_service


    def _parse_person_data(self, tmdb_data: dict) -> dict:
        """Parse TMDB person data to our database format."""
        return {
            "tmdb_id": tmdb_data.get("id"),
            "name": tmdb_data.get("name", ""),
            "profile_path": tmdb_data.get("profile_path"),
            "biography": tmdb_data.get("biography"),
            "birthday": self._parse_date(tmdb_data.get("birthday")),
            "place_of_birth": tmdb_data.get("place_of_birth"),
        }


    def _parse_cast_credits(self, film_id: int, person_id: int, member: dict) -> dict:
        """Parse TMDB cast member to FilmCredit format."""
        return {
            "film_id": film_id,
            "person_id": person_id,
            "department": "Acting",
            "job": "Actor",
            "character": member.get("character"),
            "credit_order": member.get("order"),
        }


    def _parse_crew_credits(self, film_id: int, person_id: int, member: dict) -> dict:
        """Parse TMDB crew member to FilmCredit format."""
        return {
            "film_id": film_id,
            "person_id": person_id,
            "department": member.get("department", ""),
            "job": member.get("job", ""),
            "character": None,
            "credit_order": None,
        }


    def _parse_date(self, raw_date: str | None) -> date | None:
        """Parse date string to date object."""
        if not raw_date:
            return None
        try:
            return date.fromisoformat(raw_date)
        except ValueError:
            return None


    async def get_film_credits(self, film_id: int, tmdb_id: int) -> dict:
        """Get cast and crew for a film. Fetch from TMDB and cache if not in DB."""
        if not await self.credit_repo.has_credits(film_id):
            await self._fetch_and_cache_credits(film_id, tmdb_id)

        credits = await self.credit_repo.get_film_credits(film_id)
        return self._split_and_enrich_credits(credits)


    async def _fetch_and_cache_credits(self, film_id: int, tmdb_id: int) -> None:
        """Fetch credits from TMDB and save to DB."""
        tmdb_data = await tmdb_client.get_credits(tmdb_id)

        credits_to_create = []

        for member in tmdb_data.get("cast", []):
            person = await self.person_repo.get_or_create(
                {"tmdb_id": member["id"], "name": member["name"], "profile_path": member.get("profile_path")}
            )
            credits_to_create.append(self._parse_cast_credits(film_id, person.id, member))

        for member in tmdb_data.get("crew", []):
            person = await self.person_repo.get_or_create(
                {"tmdb_id": member["id"], "name": member["name"], "profile_path": member.get("profile_path")}
            )
            credit = self._parse_crew_credits(film_id, person.id, member)
            credit["is_key"] = member.get("job") in KEY_JOBS
            credits_to_create.append(credit)

        await self.credit_repo.bulk_create_credits(credits_to_create)
        await self.db.commit()


    def _split_and_enrich_credits(self, credits: list) -> dict:
        """Split credits into cast/crew and add profile URLs."""
        cast, crew = [], []
        for credit in credits:
            person = credit.person
            entry = {
                "tmdb_id": person.tmdb_id,
                "name": person.name,
                "profile_url": tmdb_client.get_image_url(person.profile_path, size="w185") if person.profile_path else None,
                "job": credit.job,
                "department": credit.department,
                "character": credit.character,
                "order": credit.credit_order,
                "is_key": credit.is_key,
            }
            if credit.department == "Acting":
                cast.append(entry)
            else:
                crew.append(entry)

        cast.sort(key=lambda x: x["order"] if x["order"] is not None else 9999)
        return {"cast": cast, "crew": crew}


    async def get_person_detail(self, tmdb_id: int) -> dict:
        """Get person detail. Fetch from TMDB if details are missing."""
        person = await self.person_repo.get_by_tmdb_id(tmdb_id)

        has_details = person and any([
            person.biography,
            person.birthday,
            person.place_of_birth,
        ])

        if not has_details:
            tmdb_data = await tmdb_client.get_person(tmdb_id)
            person_data = self._parse_person_data(tmdb_data)
            if person:
                for key, value in person_data.items():
                    if getattr(person, key) is None and value is not None:
                        setattr(person, key, value)
            else:
                person = await self.person_repo.create(person_data)
            await self.db.commit()
            await self.db.refresh(person)

        return self._enrich_person(person)


    async def get_person_jobs(self, tmdb_id: int) -> list[str]:
        """Get all unique jobs from cached person films."""
        cache_key = f"person:films:{tmdb_id}"
        cached = await redis_cache.get(cache_key)

        if cached is not None:
            # extract jobs from already cached movies
            jobs = set()
            for film in cached:
                for job in film.get("jobs", []):
                    jobs.add(job)
            return sorted(list(jobs))

        # if there is no cache — as before
        tmdb_data = await tmdb_client.get_person_film_credits(tmdb_id)
        jobs = set()
        for item in tmdb_data.get("cast", []):
            jobs.add("Actor")
        for item in tmdb_data.get("crew", []):
            if item.get("job"):
                jobs.add(item["job"])
        return sorted(list(jobs))


    async def get_person_films(self, person_id: int, tmdb_id: int) -> list[dict]:
        """Get all films for a person directly from TMDB."""
        cache_key = f"person:films:{tmdb_id}"

        cached = await redis_cache.get(cache_key)
        if cached is not None:
            return cached

        tmdb_data = await tmdb_client.get_person_film_credits(tmdb_id)

        # genres map from Redis
        genres_list = await redis_cache.get("tmdb:genres") or []
        genres_map = {g["id"]: g["name"] for g in genres_list}

        tmdb_jobs = {}
        for item in tmdb_data.get("cast", []):
            tmdb_jobs.setdefault(item["id"], []).append({
                "job": "Actor",
                "department": "Acting",
                "character": item.get("character"),
            })
        for item in tmdb_data.get("crew", []):
            tmdb_jobs.setdefault(item["id"], []).append({
                "job": item.get("job", ""),
                "department": item.get("department", ""),
                "character": None,
            })

        seen = set()
        films = []
        for item in tmdb_data.get("cast", []) + tmdb_data.get("crew", []):
            if item["id"] in seen:
                continue
            seen.add(item["id"])

            jobs = tmdb_jobs.get(item["id"], [])
            all_jobs = list({j["job"] for j in jobs})
            characters = [j["character"] for j in jobs if j["character"]]
            release_date = item.get("release_date") or None

            films.append({
                "tmdb_id": item["id"],
                "title": item.get("title", ""),
                "poster_url": tmdb_client.get_image_url(item.get("poster_path")),
                "release_date": release_date,
                "vote_average": item.get("vote_average", 0.0),
                "popularity": item.get("popularity", 0.0),
                "runtime": None,
                "jobs": all_jobs,
                "character": characters[0] if characters else None,
                "genres": [
                    {"id": gid, "name": genres_map.get(gid, "")}
                    for gid in item.get("genre_ids", [])
                ],
            })

        films.sort(key=lambda x: x["release_date"] or "", reverse=True)

        await redis_cache.set(cache_key, films, TTL.FILM)
        return films


    async def search(self, query: str, limit: int = 5, page: int = 1) -> list[dict]:
        """Search for people on TMDB and return their main known-for titles."""
        tmdb_data = await tmdb_client.search_person(query, page=page)
        results = []

        for item in tmdb_data.get("results", [])[:limit]:
            known_for_list = item.get("known_for", [])
            top_film = None
            if known_for_list:
                top_film = known_for_list[0].get("title") or known_for_list[0].get("name")

            results.append({
                "tmdb_id": item["id"],
                "name": item["name"],
                "profile_url": tmdb_client.get_image_url(
                    item.get("profile_path"), size="w185"
                ) if item.get("profile_path") else None,
                "known_for": item.get("known_for_department"),
                "top_film": top_film,
            })

        return results


    def _enrich_person(self, person) -> dict:
        """Add profile URL to person."""
        return {
            "id": person.id,
            "tmdb_id": person.tmdb_id,
            "name": person.name,
            "biography": person.biography,
            "birthday": person.birthday,
            "place_of_birth": person.place_of_birth,
            "profile_url": tmdb_client.get_image_url(person.profile_path, size="w342") if person.profile_path else None,
        }