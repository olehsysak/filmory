const tmdbId = window.location.pathname.split('/').filter(Boolean)[1];

// Initial load of credits data
loadCredits();

// Fetch cast and crew data
async function loadCredits() {
    try {
        // Fetch cast & crew data from backend API
        const res = await fetch(`/api/film/${tmdbId}/credits`);
        if (!res.ok) throw new Error('Failed to fetch credits');
        const data = await res.json();
        renderFullCast(data.cast || []);
        renderFullCrew(data.crew || []);
    } catch (e) {
        console.error('Credits error:', e);
    }
}

// Render full cast list (actors)
function renderFullCast(cast) {
    const grid = document.getElementById('fcCastGrid');
    if (!cast.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No cast data available.</p>';
        return;
    }

    // Render actor cards
    grid.innerHTML = cast.map(a => `
        <a href="/person/${a.tmdb_id}" class="crew-card">
            <img
                class="crew-card__photo"
                src="${a.profile_url || '/static/img/no-avatar.svg'}"
                alt="${a.name}"
                loading="lazy"
                onerror="this.src='/static/img/no-avatar.svg'"
            >
            <div class="crew-card__info">
                <span class="crew-card__name">${a.name}</span>
                <span class="crew-card__job">${a.character || ''}</span>
            </div>
        </a>
    `).join('');
}

// Render full crew grouped by department
function renderFullCrew(crew) {
    const container = document.getElementById('fcCrewGrid');
    if (!crew.length) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No crew data available.</p>';
        return;
    }

    const grouped = {};
    crew.forEach(c => {
        if (!grouped[c.department]) grouped[c.department] = [];
        grouped[c.department].push(c);
    });

    const html = Object.entries(grouped).map(([dept, members]) => {
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

    container.innerHTML = `<div class="crew-departments--full">${html}</div>`;
}

// Tabs
document.querySelectorAll('.fc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.fc-tab').forEach(t =>
            t.classList.remove('fc-tab--active')
        );
        tab.classList.add('fc-tab--active');
        const target = tab.dataset.tab;
        document.getElementById('fcCastPanel').classList.toggle('fc-panel--hidden', target !== 'cast');
        document.getElementById('fcCrewPanel').classList.toggle('fc-panel--hidden', target !== 'crew');
    });
});