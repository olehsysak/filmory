const tmdbId = window.location.pathname.split('/').filter(Boolean).pop();

// Backdrop zoom
const backdrop = document.querySelector('.film-hero__backdrop');
if (backdrop) setTimeout(() => backdrop.style.transform = 'scale(1)', 100);

// Animate popularity progress bar
const bar = document.querySelector('.film-popularity__bar-fill');
if (bar) {
    const target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(() => bar.style.width = target, 300);
}

loadCredits();

// Fetches film credits and renders cast, crew, and director stat sections
async function loadCredits() {
    try {
        const res = await fetch(`/api/film/${tmdbId}/credits`);
        if (!res.ok) throw new Error('Failed to fetch credits');

        const data = await res.json();

        renderTopCast(data.cast || []);
        renderTopCrew(data.crew || []);
        renderCrewStat(data.crew || []);
    } catch (e) {
        console.error('Credits error:', e);
        document.getElementById('filmCredits').style.display = 'none';
    }
}

// Render top billed cast members
function renderTopCast(cast) {
    const track = document.getElementById('topCastTrack');
    const top = cast.slice(0, 15);

    if (!top.length) {
        track.innerHTML = '<p style="color:var(--text-muted);font-size:14px;padding:8px 0;">No cast data available.</p>';
        return;
    }

    track.innerHTML = top.map(a => `
        <a href="/person/${a.tmdb_id}" class="person-card">
            <img
                class="person-card__photo"
                src="${a.profile_url || '/static/img/no-avatar.svg'}"
                alt="${a.name}"
                loading="lazy"
                onerror="this.src='/static/img/no-avatar.svg'"
            >
            <span class="person-card__name">${a.name}</span>
            <span class="person-card__sub">${a.character || ''}</span>
        </a>
    `).join('');
}

// Priority order for crew roles
const JOB_PRIORITY = [
    "Director", "Co-Director",
    "Screenplay", "Writer", "Novel",
    "Producer", "Executive Producer",
    "Director of Photography",
    "Original Music Composer",
    "Editor",
    "Production Design",
];

// Render top key crew members
function renderTopCrew(crew) {
    const grid = document.getElementById('topCrewGrid');

    // Filter only key crew roles (pre-marked by backend)
    const keyCrew = crew.filter(c => c.is_key);

    if (!keyCrew.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No crew data available.</p>';
        return;
    }

    // Merge duplicate people and collect all their jobs
    const merged = {};
    keyCrew.forEach(c => {
        if (!merged[c.tmdb_id]) {
            merged[c.tmdb_id] = { ...c, jobs: [c.job] };
        } else {
            merged[c.tmdb_id].jobs.push(c.job);
        }
    });

    // Sort by job importance
    const sorted = Object.values(merged).sort((a, b) => {
        const ai = JOB_PRIORITY.indexOf(a.jobs[0]);
        const bi = JOB_PRIORITY.indexOf(b.jobs[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const top9 = sorted.slice(0, 9);

    grid.innerHTML = top9.map(c => `
        <a href="/person/${c.tmdb_id}" class="crew-card">
            <img
                class="crew-card__photo"
                src="${c.profile_url || '/static/img/no-avatar.svg'}"
                alt="${c.name}"
                loading="lazy"
                onerror="this.src='/static/img/no-avatar.svg'"
            >
            <div class="crew-card__info">
                <span class="crew-card__name">${c.name}</span>
                <span class="crew-card__job">${c.jobs.join(', ')}</span>
            </div>
        </a>
    `).join('');
}

// Render director stat in stats row
function renderCrewStat(crew) {
    const col = document.getElementById('filmCrewStat');
    const body = document.getElementById('filmCrewStatBody');

    if (!col || !body) return;

    const directors = crew.filter(c => c.job === 'Director' || c.job === 'Co-Director');
    if (!directors.length) return;

    col.style.display = 'flex';
    body.innerHTML = directors.map(d =>
        `<a href="/person/${d.tmdb_id}" class="film-crew-stat-name">${d.name}</a>`
    ).join('<br>');
}

// Group crew by department for expandable UI sections
function renderCrewDepartments(container, crew) {
    const grouped = {};

    crew.forEach(c => {
        if (!grouped[c.department]) grouped[c.department] = [];
        grouped[c.department].push(c);
    });

    const departments = Object.entries(grouped);
    const step = 4;
    let visibleCount = 4;

    // Build HTML for department blocks
    function buildDeptHtml(entries) {
        return entries.map(([dept, members]) => {

            // Merge duplicates inside department
            const merged = {};
            members.forEach(m => {
                if (!merged[m.tmdb_id]) {
                    merged[m.tmdb_id] = { ...m, jobs: [m.job] };
                } else {
                    merged[m.tmdb_id].jobs.push(m.job);
                }
            });

            const unique = Object.values(merged);

            return `
                <div class="crew-dept">
                    <p class="crew-dept__title">${dept}</p>
                    <div class="crew-dept__list">
                        ${unique.map(c => `
                            <a href="/person/${c.tmdb_id}" class="crew-card">
                                <img
                                    class="crew-card__photo"
                                    src="${c.profile_url || '/static/img/no-avatar.svg'}"
                                    alt="${c.name}"
                                    loading="lazy"
                                    onerror="this.src='/static/img/no-avatar.svg'"
                                >
                                <div class="crew-card__info">
                                    <span class="crew-card__name">${c.name}</span>
                                    <span class="crew-card__job">${c.jobs.join(', ')}</span>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    function render() {
        const visible = departments.slice(0, visibleCount);
        const remaining = departments.length - visibleCount;
        const hasMore = remaining > 0;

        container.innerHTML = `
            <div class="crew-departments">
                ${buildDeptHtml(visible)}
            </div>
            ${hasMore ? `
                <button class="crew-toggle">
                    Show more
                    <span class="crew-toggle__count">+${Math.min(remaining, step)} departments</span>
                </button>
            ` : ''}
        `;

        container.querySelector('.crew-toggle')?.addEventListener('click', () => {
            visibleCount += step;
            render();
        });
    }

    render();
}

// Tabs (cast / crew switch)
const panels = {
    'top-cast': document.getElementById('topCastPanel'),
    'top-crew': document.getElementById('topCrewPanel'),
};

document.querySelectorAll('.film-credits__tab').forEach(tab => {
    tab.addEventListener('click', () => {

         // Remove active state from all tabs
        document.querySelectorAll('.film-credits__tab').forEach(t =>
            t.classList.remove('film-credits__tab--active')
        );

        // Activate clicked tab
        tab.classList.add('film-credits__tab--active');

        const target = tab.dataset.tab;

        // Toggle visible panel based on selected tab
        Object.entries(panels).forEach(([key, panel]) => {
            panel.classList.toggle('film-credits__panel--hidden', key !== target);
        });
    });
});

// Horizontal scroll helper for reusable rows (cast, similar, etc.)
function initRow(wrapper) {
    if (!wrapper) return;

    const track = wrapper.querySelector('.film-row__track');
    const prev = wrapper.querySelector('.row-arrow--prev');
    const next = wrapper.querySelector('.row-arrow--next');

    const scrollBy = 340;

    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -scrollBy, behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: scrollBy, behavior: 'smooth' }));
}

const filmActions = document.getElementById('filmActions');
const tmdbIdActions = filmActions?.dataset.tmdbId;

// Initialize all user interactions on film page
async function initFilmActions() {
    if (!filmActions || !tmdbIdActions) return;

    // Check auth state
    const res = await fetch('/api/auth/me');

    // Guest mode (disable interactions but still show public lists)
    if (!res.ok) {
        filmActions.classList.add('film-actions--guest');
        blockGuestClicks();
        loadFilmInLists();
        return;
    }

    // Load user-specific film state (status, rating, favorite)
    await loadFilmState();

    // Public lists are visible for both guests and logged users
    loadFilmInLists();

    document.getElementById('favoriteBtn')
        ?.addEventListener('click', toggleFavorite);

    document.querySelectorAll('.film-status-btn').forEach(btn => {
        btn.addEventListener('click', () => setStatus(btn.dataset.status));
    });

    document.querySelectorAll('.film-rating-star').forEach(btn => {
        btn.addEventListener('click', () => setRating(parseInt(btn.dataset.value)));
    });

    initAddToList();
}

// Prevent interaction for guest users
function blockGuestClicks() {
    filmActions.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', e => e.preventDefault());
    });
}

// Load user film state (watch status, rating, favorite)
async function loadFilmState() {
    try {
        const [watchRes, favRes] = await Promise.all([
            fetch(`/api/user/films/state/${tmdbIdActions}`),
            fetch(`/api/user/favorites/state/${tmdbIdActions}`),
        ]);

        if (watchRes.ok) {
            const data = await watchRes.json();
            applyStatus(data.status);
            if (data.rating) applyRating(data.rating);
        }

        if (favRes.ok) {
            const data = await favRes.json();
            applyFavorite(data.is_favorite);
        }
    } catch (e) {
        console.error('Failed to load film state:', e);
    }
}

// Set or toggle watch status for film
async function setStatus(newStatus) {
    const activeBtn = document.querySelector('.film-status-btn[data-active="true"]');
    const currentStatus = activeBtn?.dataset.status;

    try {
        // If clicking same status → remove it
        if (currentStatus === newStatus) {
            const res = await fetch(`/api/user/films/${tmdbIdActions}`, { method: 'DELETE' });

            if (!res.ok) throw new Error();

            applyStatus(null);
            applyRating(null);

        } else {
            const res = await fetch(`/api/user/films/${tmdbIdActions}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) throw new Error();

            const data = await res.json();
            applyStatus(data.status);
            applyRating(data.rating ?? null);
        }
    } catch {
        console.error('Failed to set status');
    }
}

// Toggle favorite state for film
async function toggleFavorite() {
    const btn = document.getElementById('favoriteBtn');
    const isActive = btn.dataset.active === 'true';

    try {
        if (isActive) {
            const res = await fetch(`/api/user/favorites/${tmdbIdActions}`, { method: 'DELETE' });

            if (!res.ok) throw new Error();
            applyFavorite(false);

        } else {
            const res = await fetch(`/api/user/favorites/${tmdbIdActions}`, { method: 'POST' });

            if (!res.ok) throw new Error();
            applyFavorite(true);
        }
    } catch {
        console.error('Failed to toggle favorite');
    }
}

// Set or update user rating
async function setRating(value) {
    const activeRating = document.querySelector('.film-rating-star[data-active="true"]');
    const currentRating = activeRating ? parseInt(activeRating.dataset.value) : null;

    try {
        // Clicking same rating removes it (fallback to completed without rating)
        if (currentRating === value) {
            await fetch(`/api/user/films/${tmdbIdActions}`, { method: 'DELETE' });

            const res = await fetch(`/api/user/films/${tmdbIdActions}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }),
            });

            if (!res.ok) throw new Error();
            applyRating(null);

        } else {
            const res = await fetch(`/api/user/films/${tmdbIdActions}/rating`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: value }),
            });

            if (!res.ok) throw new Error();
            applyRating(value);
        }
    } catch {
        console.error('Failed to set rating');
    }
}

// Update UI for watch status
function applyStatus(status) {
    document.querySelectorAll('.film-status-btn').forEach(btn => {
        btn.dataset.active = btn.dataset.status === status ? 'true' : 'false';
    });

    const isCompleted = status === 'completed';
    const ratingBlock = document.getElementById('ratingBlock');
    const ratingLocked = document.getElementById('ratingLocked');

    if (ratingBlock) ratingBlock.style.display = isCompleted ? 'block' : 'none';
    if (ratingLocked) ratingLocked.style.display = isCompleted ? 'none' : 'block';
}

// Update favorite UI state
function applyFavorite(isActive) {
    const btn = document.getElementById('favoriteBtn');
    if (!btn) return;
    btn.dataset.active = isActive ? 'true' : 'false';
}

// Update rating UI state
function applyRating(value) {
    document.querySelectorAll('.film-rating-star').forEach(btn => {
        btn.dataset.active = parseInt(btn.dataset.value) === value ? 'true' : 'false';
    });
}

// Load public lists that contain this film
async function loadFilmInLists() {
    const body = document.getElementById('filmInListsBody');

    if (!body || !tmdbIdActions) return;

    try {
        const res = await fetch(`/api/film/${tmdbIdActions}/public-lists`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (!data.length) {
            body.innerHTML = '<span class="film-in-lists__empty">Not in any public lists yet.</span>';
            return;
        }

        body.innerHTML = data.map(list => `
            <a href="/list/${list.id}" class="film-in-list-item">
                ${list.cover_url
                    ? `<img class="film-in-list-item__cover" src="${list.cover_url}" alt="">`
                    : `<div class="film-in-list-item__cover"></div>`
                }
                <div class="film-in-list-item__info">
                    <span class="film-in-list-item__name">${list.name}</span>
                    <span class="film-in-list-item__meta">by ${list.username} · ${list.film_count} films</span>
                </div>
            </a>
        `).join('');
    } catch {
        body.innerHTML = '<span class="film-in-lists__empty">Could not load lists.</span>';
    }
}

initFilmActions();