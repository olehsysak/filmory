const tmdbId = window.location.pathname.split('/').filter(Boolean).pop();

// Backdrop zoom
const backdrop = document.querySelector('.film-hero__backdrop');
if (backdrop) setTimeout(() => backdrop.style.transform = 'scale(1)', 100);

// Popularity bar
const bar = document.querySelector('.film-popularity__bar-fill');
if (bar) {
    const target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(() => bar.style.width = target, 300);
}

// Similar films row
initRow(document.querySelector('.film-similar .film-row__wrapper'));

// Credits
loadCredits();

async function loadCredits() {
    try {
        const res = await fetch(`/api/film/${tmdbId}/credits`);
        if (!res.ok) throw new Error('Failed to fetch credits');
        const data = await res.json();
        renderTopCast(data.cast || []);
        renderTopCrew(data.crew || []);
    } catch (e) {
        console.error('Credits error:', e);
        document.getElementById('filmCredits').style.display = 'none';
    }
}

// Top Cast
function renderTopCast(cast) {
    const track = document.getElementById('topCastTrack');
    const top = cast.slice(0, 12);
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
    initRow(document.querySelector('#topCastPanel .film-row__wrapper'));
}

// Priority order for crew roles (used for sorting)
const JOB_PRIORITY = [
    "Director", "Co-Director",
    "Screenplay", "Writer", "Novel",
    "Producer", "Executive Producer",
    "Director of Photography",
    "Original Music Composer",
    "Editor",
    "Production Design",
];

// Top Crew (grid, key roles only)
function renderTopCrew(crew) {
    const grid = document.getElementById('topCrewGrid');
    const keyCrew = crew.filter(c => c.is_key);

    if (!keyCrew.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No crew data available.</p>';
        return;
    }

    // Deduplicate by tmdb_id and merge jobs
    const merged = {};
    keyCrew.forEach(c => {
        if (!merged[c.tmdb_id]) {
            merged[c.tmdb_id] = { ...c, jobs: [c.job] };
        } else {
            merged[c.tmdb_id].jobs.push(c.job);
        }
    });

    const sorted = Object.values(merged).sort((a, b) => {
        const ai = JOB_PRIORITY.indexOf(a.jobs[0]);
        const bi = JOB_PRIORITY.indexOf(b.jobs[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const top12 = sorted.slice(0, 12);

    grid.innerHTML = top12.map(c => `
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

// Shared
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

// Tabs
const panels = {
    'top-cast': document.getElementById('topCastPanel'),
    'top-crew': document.getElementById('topCrewPanel'),
};

document.querySelectorAll('.film-credits__tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.film-credits__tab').forEach(t =>
            t.classList.remove('film-credits__tab--active')
        );
        tab.classList.add('film-credits__tab--active');
        const target = tab.dataset.tab;
        Object.entries(panels).forEach(([key, panel]) => {
            panel.classList.toggle('film-credits__panel--hidden', key !== target);
        });
    });
});

// Row helper
function initRow(wrapper) {
    if (!wrapper) return;
    const track = wrapper.querySelector('.film-row__track');
    const prev = wrapper.querySelector('.row-arrow--prev');
    const next = wrapper.querySelector('.row-arrow--next');
    const scrollBy = 340;
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -scrollBy, behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: scrollBy, behavior: 'smooth' }));
}