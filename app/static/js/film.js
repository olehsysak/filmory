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
        renderCast(data.cast || []);
        renderCrew(data.crew || []);
    } catch (e) {
        console.error('Credits error:', e);
        document.getElementById('filmCredits').style.display = 'none';
    }
}

function renderCast(cast) {
    const track = document.getElementById('castTrack');
    if (!cast.length) {
        track.innerHTML = '<p style="color:var(--text-muted);font-size:14px;padding:8px 0;">No cast data available.</p>';
        return;
    }
    track.innerHTML = cast.map(a => `
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

    initRow(document.querySelector('.film-credits .film-row__wrapper'));
}

function renderCrew(crew) {
    const grid = document.getElementById('crewGrid');
    if (!crew.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No crew data available.</p>';
        return;
    }

    const grouped = {};
    crew.forEach(c => {
        if (!grouped[c.department]) grouped[c.department] = [];
        grouped[c.department].push(c);
    });

    const departments = Object.entries(grouped);
    const step = 4;
    let visibleCount = 4;

    function renderDepartments(entries) {
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

        grid.innerHTML = `
            <div class="crew-departments">
                ${renderDepartments(visible)}
            </div>
            ${hasMore ? `
                <button class="crew-toggle" id="crewToggle">
                    Show more
                    <span class="crew-toggle__count">+${Math.min(remaining, step)} departments</span>
                </button>
            ` : ''}
        `;

        const toggleBtn = document.getElementById('crewToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                visibleCount += step;
                render();
            });
        }
    }

    render();
}

// ── Tabs ───────────────────────────────────────────────────
document.querySelectorAll('.film-credits__tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.film-credits__tab').forEach(t => t.classList.remove('film-credits__tab--active'));
        tab.classList.add('film-credits__tab--active');

        const target = tab.dataset.tab;
        document.getElementById('castPanel').classList.toggle('film-credits__panel--hidden', target !== 'cast');
        document.getElementById('crewPanel').classList.toggle('film-credits__panel--hidden', target !== 'crew');
    });
});