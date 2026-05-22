'use strict';

/* Handles hero carousel autoplay, navigation, and pause-on-hover behavior */
(function initHero() {
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;

    const slides = Array.from(carousel.querySelectorAll('.idx-hero__slide'));
    const dots   = Array.from(carousel.querySelectorAll('.idx-hero__dot'));
    if (!slides.length) return;

    let current = 0;
    let timer   = null;

    /* Switches active slide by index */
    function goTo(idx) {
        slides[current].classList.remove('active');
        dots[current].classList.remove('active');

        current = (idx + slides.length) % slides.length;

        slides[current].classList.add('active');
        dots[current].classList.add('active');
    }

    /* Starts automatic slide rotation */
    function start() {
        clearInterval(timer);
        timer = setInterval(() => goTo(current + 1), 6000);
    }

    /* Enables dot navigation */
    dots.forEach(d => d.addEventListener('click', () => { goTo(+d.dataset.index); start(); }));

    /* Pauses autoplay on hover and resumes on leave */
    carousel.addEventListener('mouseenter', () => clearInterval(timer));
    carousel.addEventListener('mouseleave', start);

    start();
})();

/* Handles switching between trending time periods and rendering film cards */
(function initTrendingTabs() {
    const tabs   = document.querySelectorAll('.trending-tab');
    const track  = document.getElementById('trendingTrack');
    const seeAll = document.getElementById('trendingSeeAll');
    if (!tabs.length || !track) return;

    const dayHTML   = track.innerHTML;
    const weekFilms = window.__TRENDING_WEEK__ || [];

    /* Builds HTML for a single film card */
    function filmCardHTML(f) {
        const poster = f.poster_url
            ? `<img class="film-card__poster" src="${esc(f.poster_url)}" alt="${esc(f.title)}" loading="lazy">`
            : `<div class="film-card__no-poster">No Image</div>`;

        const rating = f.vote_average
            ? `<span class="film-card__rating">★ ${Number(f.vote_average).toFixed(1)}</span>`
            : '';

        const year = f.release_date ? esc(String(f.release_date)) : '';

        return `
            <a href="/film/${f.tmdb_id}" class="film-card">
                ${poster}
                <div class="film-card__info">
                    <p class="film-card__title">${esc(f.title)}</p>
                    <p class="film-card__meta">${year} ${rating}</p>
                </div>
            </a>
        `;
    }

    let currentPeriod = 'day';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const period = tab.dataset.period;
            if (period === currentPeriod) return;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPeriod = period;

            if (seeAll) seeAll.href = `/films?trending_period=${period}`;

            if (period === 'day') {
                track.innerHTML = dayHTML;
                return;
            }

            if (weekFilms.length) {
                track.innerHTML = weekFilms.map(filmCardHTML).join('');
                return;
            }

            // fallback fetch
            track.innerHTML = skeletons(8);
            fetch('/api/film/catalog?trending_period=week&page=1')
                .then(r => r.json())
                .then(data => {
                    const films = data.films || [];
                    track.innerHTML = films.length
                        ? films.map(filmCardHTML).join('')
                        : '<p class="film-row__empty">No films available.</p>';
                })
                .catch(() => { track.innerHTML = '<p class="film-row__empty">Failed to load.</p>'; });
        });
    });
})();

/* Loads and renders most liked community lists from API */
(async function initPopularLists() {
    const grid = document.getElementById('popularListsGrid');
    if (!grid) return;

    try {
        const res  = await fetch('/api/community/lists/most-liked');
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (!data.length) {
            grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;grid-column:1/-1;padding:20px 0">No lists yet.</p>';
            return;
        }
        grid.innerHTML = data.slice(0, 6).map(list => renderListCard(list, {
            showAuthor: true,
            showViews:  true,
        })).join('');
    } catch {
        grid.innerHTML = '';
    }
})();

/* Escapes HTML to prevent XSS when rendering dynamic content */
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}

/* Generates loading skeleton placeholders for film cards */
function skeletons(n) {
    return Array(n).fill(
        `<div class="film-card" style="flex:0 0 150px">
            <div style="background:var(--bg-secondary);border-radius:8px;aspect-ratio:2/3;
                 animation:skeleton-pulse 1.5s ease-in-out infinite"></div>
         </div>`
    ).join('');
}

/* Injects skeleton animation styles once per page load */
if (!document.getElementById('_skKF')) {
    const s = document.createElement('style');
    s.id = '_skKF';
    s.textContent = '@keyframes skeleton-pulse{0%,100%{opacity:1}50%{opacity:.4}}';
    document.head.appendChild(s);
}