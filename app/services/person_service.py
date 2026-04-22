import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_maker
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
        birthday = None
        raw_date = tmdb_data.get("birthday")
        if raw_date:
            try:
                birthday = date.fromisoformat(raw_date)
            except ValueError:
                birthday = None

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


    async def _cache_full_details(self, items: list) -> None:
        """Cache full film details — each film gets its own DB session."""
        semaphore = asyncio.Semaphore(5)

        async def fetch_one(item):
            async with semaphore:
                try:
                    async with async_session_maker() as session:
                        from app.services.film_service import FilmService
                        service = FilmService(session)
                        await service.get_or_fetch_film(item["id"])
                except Exception:
                    pass

        await asyncio.gather(*[fetch_one(item) for item in items])


    async def get_person_detail(self, tmdb_id: int) -> dict:
        """Get person detail. Fetch from TMDB if bio is missing."""
        person = await self.person_repo.get_by_tmdb_id(tmdb_id)

        if not person or not person.biography:
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
        """Get all unique jobs for a person directly from TMDB."""
        tmdb_data = await tmdb_client.get_person_film_credits(tmdb_id)
        jobs = set()
        for item in tmdb_data.get("cast", []):
            jobs.add("Actor")
        for item in tmdb_data.get("crew", []):
            if item.get("job"):
                jobs.add(item["job"])
        return sorted(list(jobs))


    async def get_person_films(self, person_id: int, tmdb_id: int) -> list[dict]:
        tmdb_data = await tmdb_client.get_person_film_credits(tmdb_id)

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

        all_items = []
        seen = set()
        for item in tmdb_data.get("cast", []) + tmdb_data.get("crew", []):
            if item["id"] not in seen:
                seen.add(item["id"])
                all_items.append(item)

        await self._cache_full_details(all_items)

        films = []
        for item in all_items:
            film = await self.film_repo.get_by_tmdb_id(item["id"])
            if not film:
                continue

            jobs = tmdb_jobs.get(item["id"], [])
            all_jobs = list({j["job"] for j in jobs})
            characters = [j["character"] for j in jobs if j["character"]]

            films.append({
                "tmdb_id": film.tmdb_id,
                "title": film.title,
                "poster_url": tmdb_client.get_image_url(film.poster_path),
                "release_date": film.release_date,
                "vote_average": film.vote_average,
                "popularity": film.popularity,
                "runtime": film.runtime,
                "jobs": all_jobs,
                "character": characters[0] if characters else None,
                "genres": [{"id": g.tmdb_id, "name": g.name} for g in film.genres],
            })

        films.sort(key=lambda x: x["release_date"] or date.min, reverse=True)
        return films


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