# 🎬 Filmory

**Filmory** is a web platform for cataloging and browsing information about films. Users can track their watchlist, rate movies, create and share curated lists, follow other members, and discover trending content — all backed by live data from the TMDB API.

🌐 **Live demo:** [filmory-production.up.railway.app](https://filmory-production.up.railway.app)

---

## ✨ Features

- **Film catalog** — browse by genre, year, runtime, rating; filter upcoming releases
- **Personal collection** — track films by status (`watching`, `completed`, `planned`, `dropped`) and leave ratings
- **Favorites** — independently bookmark films outside the watchlist
- **Custom lists** — create public or private lists, like and fork others' lists
- **People** — actor/crew profiles with filmographies and job breakdowns
- **Search** — unified search across films, people, members, and lists
- **Community** — leaderboard of trending members and most-liked lists
- **User profiles** — pinned films & lists, activity feed, rating histogram, top genres, privacy controls
- **Authentication** — JWT stored in HttpOnly cookies, guest mode with disabled interactivity

---

## 🛠 Tech Stack

| Technology | Role |
|---|---|
| **FastAPI** | Async REST API framework |
| **PostgreSQL 16** | Primary relational database |
| **SQLAlchemy** + **Alembic** | Async ORM and migrations |
| **Redis 7** | Caching layer with TTL and allkeys-lru eviction |
| **Jinja2** + **Vanilla JS** | Server-side templating with client-side interactivity |
| **JWT** | Authentication via HttpOnly cookies |
| **TMDB API** | External film data source with async client |
| **Docker Compose** | Containerized local and production setup |

---

## 🧠 Architecture

The project follows a 7-layer architecture:

- **Client** — browser-side rendering via Jinja2 templates and Vanilla JS modules
- **Router** — FastAPI endpoints with AuthMiddleware attaching the user to every request
- **Service** — all business logic (auth, films, lists, profile, community, search)
- **Data** — repositories abstracting database access via SQLAlchemy async sessions; shared `filters.py` for reusable film filtering and sorting
- **Database** — PostgreSQL as the primary relational store
- **Cache** — Redis with TTL-based caching per request type and allkeys-lru eviction
- **External** — async TMDB API client with Redis TTL caching and graceful fallback mode

---

## ⚙️ Getting Started

### Prerequisites

- Docker & Docker Compose
- TMDB API key — get one at [themoviedb.org](https://www.themoviedb.org/settings/api)

### 1. Clone the repository

```bash
git clone https://github.com/olehsysak/filmory.git
cd filmory
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in only `TMDB_API_KEY` — all other values are pre-configured in `.env.example`.

### 🐳 Docker Compose

**Start all services:**

```bash
docker compose up --build
```

This starts three containers:
- `app` — FastAPI application
- `db` — PostgreSQL
- `redis` — Redis

On startup, the app automatically initializes Redis and syncs genres from TMDB.

The application will be available at **http://localhost:8000**.

**Useful commands:**
 
```bash
docker compose up -d            # Run in background
docker compose logs -f app      # Stream app logs
docker compose down             # Stop all containers
docker compose down -v          # Stop and remove volumes (clears DB)
```

---

## 📄 License

This project was developed as a professional junior bachelor's qualification work at the University of King Danylo (Університет Короля Данила), specializing in Software Engineering (121 — Інженерія програмного забезпечення).
