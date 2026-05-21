'use strict';

// Initialization
let activePeopleTab = 'watchers';

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        fetchPeople(),
        fetchMostLiked(),
        fetchMostViewed(),
        fetchNew(),
    ]);
});

// Constants / Icons

// Film icon
const iconFilm = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.296 3.464 3.02 3.956"/><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m6.18 5.276 3.1 3.899"/></svg>`;

// Heart icon (likes)
const iconHeart = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

// Eye icon (views)
const iconEye = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

// Star icon (ratings)
const iconStar = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

// Fetches and renders top watchers and top curators
async function fetchPeople() {
    const grid = document.getElementById('cmPeopleGrid');
    grid.innerHTML = renderPeopleSkeletons();

    try {
        // Fetch both datasets in parallel
        const [watchersRes, curatorsRes] = await Promise.all([
            fetch('/api/community/people/top-watchers?limit=5'),
            fetch('/api/community/people/top-curators?limit=5'),
        ]);

        if (!watchersRes.ok || !curatorsRes.ok) throw new Error();

        const watchers = await watchersRes.json();
        const curators = await curatorsRes.json();

        if (!watchers.length && !curators.length) {
            grid.innerHTML = `<p class="cm-empty">No data yet for this month.</p>`;
            return;
        }

        // Render both columns: watchers + curators
        grid.innerHTML = `
            <div class="cm-people-col">
                <p class="cm-people-col__label">Most watched</p>
                ${watchers.map((p, i) => renderPersonRow(p, i + 1, 'watchers')).join('')}
            </div>
            <div class="cm-people-col">
                <p class="cm-people-col__label">Most liked creators</p>
                ${curators.map((p, i) => renderPersonRow(p, i + 1, 'curators')).join('')}
            </div>
        `;
    } catch {
        grid.innerHTML = `<p class="cm-empty">Failed to load.</p>`;
    }
}

// Renders a single person row depending on type (watcher or curator)
function renderPersonRow(person, rank, type) {
    // Build avatar (image or fallback initial)
    const avatar = person.avatar_url
        ? `<img src="${esc(person.avatar_url)}" alt="" class="cm-person-row__avatar-img">`
        : `<div class="cm-person-row__avatar-placeholder">${esc(person.username[0].toUpperCase())}</div>`;

    let stat;

    // Watchers statistics
    if (type === 'watchers') {
        const parts = [`${iconFilm} ${person.recent_watched} watched`];
        if (person.ratings_count > 0) parts.push(`${iconStar} ${person.ratings_count} rated`);
        if (person.avg_rating) parts.push(`avg ${person.avg_rating}`);
        stat = parts.join(' · ');
    // Curators statistics
    } else {
        const parts = [`${iconHeart} ${person.recent_likes} likes`];
        if (person.recent_views > 0) parts.push(`${iconEye} ${person.recent_views} views`);
        stat = parts.join(' · ');
    }

    return `
        <a href="/users/${esc(person.username)}" class="cm-person-row">
            <span class="cm-person-row__rank">${rank}</span>
            <div class="cm-person-row__avatar">${avatar}</div>
            <div class="cm-person-row__info">
                <p class="cm-person-row__name">${esc(person.username)}</p>
                <p class="cm-person-row__stat">${stat}</p>
            </div>
        </a>
    `;
}

// Generates loading skeleton UI for people section
function renderPeopleSkeletons() {
    const col = Array(5).fill(`
        <div class="cm-person-row cm-person-row--skeleton">
            <div class="skeleton-box" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;"></div>
            <div class="skeleton-box" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;"></div>
            <div style="flex:1;">
                <div class="skeleton-box" style="height:11px;width:65%;border-radius:4px;margin-bottom:4px;"></div>
                <div class="skeleton-box" style="height:9px;width:45%;border-radius:4px;"></div>
            </div>
        </div>
    `).join('');

    return `
        <div class="cm-people-col">
            <div class="skeleton-box" style="height:10px;width:80px;border-radius:4px;margin-bottom:10px;"></div>
            ${col}
        </div>
        <div class="cm-people-col">
            <div class="skeleton-box" style="height:10px;width:80px;border-radius:4px;margin-bottom:10px;"></div>
            ${col}
        </div>
    `;
}

// Fetches and renders most liked lists (top 6)
async function fetchMostLiked() {
    const grid = document.getElementById('cmLikedGrid');
    renderListSkeletons(grid, 6);

    try {
        const res = await fetch('/api/community/lists/most-liked');
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (!data.length) {
            grid.innerHTML = `<p class="cm-empty">No liked lists yet this month.</p>`;
            return;
        }

        grid.className = 'cm-liked-grid-6';
        grid.innerHTML = data.slice(0, 6).map(list => renderListCard(list, {
            showAuthor: true,
            showViews: true,
        })).join('');
    } catch {
        grid.innerHTML = `<p class="cm-empty">Failed to load.</p>`;
    }
}

// Fetches and renders most viewed lists (top 8)
async function fetchMostViewed() {
    const container = document.getElementById('cmViewedList');
    renderListSkeletons(container, 8);

    try {
        const res = await fetch('/api/community/lists/most-viewed');
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (!data.length) {
            container.innerHTML = `<p class="cm-empty">No views recorded yet this month.</p>`;
            return;
        }

        container.innerHTML = data.map(list => renderListCard(list, {
            showAuthor: true,
            showDesc: true,
            showViews: true,
            row: true,
        })).join('');
    } catch {
        container.innerHTML = `<p class="cm-empty">Failed to load.</p>`;
    }
}

// Fetches and renders newly created lists (top 6)
async function fetchNew() {
    const container = document.getElementById('cmNewList');
    renderListSkeletons(container, 6);

    try {
        const res = await fetch('/api/community/lists/new');
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (!data.length) {
            container.innerHTML = `<p class="cm-empty">No new lists this month.</p>`;
            return;
        }

        container.innerHTML = data.map(list => renderListCard(list, {
            showAuthor: true,
            showFilmCount: true,
            showLikes: false,
            showNewBadge: true,
        })).join('');
    } catch {
        container.innerHTML = `<p class="cm-empty">Failed to load.</p>`;
    }
}

// Escapes HTML to prevent XSS
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}