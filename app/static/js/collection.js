// Titles for each collection tab
const TAB_TITLES = {
    want_to_watch: 'Want to Watch',
    watching: 'Watching',
    completed: 'Completed',
    dropped: 'Dropped',
    favorites: 'Favorites',
};

// API endpoints mapped to each tab
const TAB_ENDPOINTS = {
    want_to_watch: '/api/user/films/want-to-watch',
    watching: '/api/user/films/watching',
    completed: '/api/user/films/completed',
    dropped: '/api/user/films/dropped',
    favorites: '/api/user/favorites/',
};

// Tabs that support user-specific rating filters
const RATED_ONLY_TABS = new Set(['completed', 'favorites']);

// Central state object controlling filters and active tab
const state = {
    tab: ACTIVE_TAB,
    sort: 'added_desc',
    genre_id: null,
    year: null,
    year_from: null,
    year_to: null,
    runtime_min: null,
    runtime_max: null,
    search: '',
};

// Labels for runtime filter options
const durationLabels = {
    short: 'Short · < 90 min',
    standard: 'Standard · 90–150 min',
    long: 'Long · > 150 min',
};

// Fetches collection data from the API based on current state filters and renders the results into the grid
async function fetchCollection() {
    const grid = document.getElementById('collectionGrid');
    const empty = document.getElementById('collectionEmpty');
    const count = document.getElementById('collectionCount');

    renderSkeletons();
    empty.style.display = 'none';

    // Build query parameters based on active filters
    const params = new URLSearchParams();
    if (state.genre_id) params.set('genre_id', state.genre_id);
    if (state.year) params.set('year', state.year);
    if (state.year_from) params.set('year_from', state.year_from);
    if (state.year_to) params.set('year_to', state.year_to);
    if (state.runtime_min) params.set('runtime_min', state.runtime_min);
    if (state.runtime_max) params.set('runtime_max', state.runtime_max);

    // Special sorting cases for rating-based filters
    if (state.sort === 'rated_only') {
        params.set('rated_only', 'true');
    } else if (state.sort === 'unrated_only') {
        params.set('unrated_only', 'true');
    } else {
        params.set('sort', state.sort);
    }

    if (state.search) params.set('search', state.search);

    try {
        const url = `${TAB_ENDPOINTS[state.tab]}?${params}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();

        const countEl = document.getElementById(`count-${state.tab}`);
        if (countEl) countEl.textContent = data.length;

        count.textContent = `${data.length} films`;

        if (!data.length) {
            grid.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = data.map(entry => renderCard(entry)).join('');

    } catch {
        grid.style.display = 'none';
        empty.style.display = 'flex';
    }
}

// Renders a single film card inside the collection grid
function renderCard(entry) {
    const film = entry.film;

    const tmdbRating = film.vote_average
        ? `<span class="collection-card__tmdb-rating">★ ${film.vote_average.toFixed(1)}</span>`
        : '';

    const userRating = entry.rating
        ? `<span class="collection-card__user-rating">★ ${entry.rating}</span>`
        : '';

    const year = film.release_date
        ? `<span class="collection-card__year">${film.release_date.substring(0, 4)}</span>`
        : '';

    return `
        <a href="/film/${film.tmdb_id}" class="collection-card">
            ${film.poster_url
                ? `<img class="collection-card__poster" src="${film.poster_url}" alt="${escapeHtml(film.title)}" loading="lazy">`
                : `<div class="collection-card__poster"></div>`
            }
            <div class="collection-card__info">
                <p class="collection-card__title">${escapeHtml(film.title)}</p>
                <div class="collection-card__meta">
                    ${tmdbRating}
                    ${userRating}
                    ${year}
                </div>
            </div>
        </a>
    `;
}

// Renders skeleton placeholders while data is loading
function renderSkeletons() {
    const grid = document.getElementById('collectionGrid');
    grid.style.display = 'grid';
    grid.innerHTML = Array(8).fill(`
        <div class="collection-card collection-card--skeleton">
            <div class="collection-card__poster skeleton-box"></div>
            <div class="collection-card__info">
                <div class="skeleton-box" style="height:14px;width:80%;margin-bottom:8px;"></div>
                <div class="skeleton-box" style="height:12px;width:50%;"></div>
            </div>
        </div>
    `).join('');
}

// Switches active collection tab and reloads data
function switchTab(tab) {
    const prevCountEl = document.getElementById(`count-${state.tab}`);
    if (prevCountEl) prevCountEl.textContent = '—';

    state.tab = tab;
    resetFilters(false);

    document.getElementById('collectionTitle').textContent = TAB_TITLES[tab] || tab;

    // Update active tab in sidebar navigation
    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        const href = item.getAttribute('href');
        item.classList.toggle('collection-nav__item--active', href.includes(`tab=${tab}`));
    });

    updateRatingSection(tab);

    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);

    fetchCollection();
}

// Loads available genres from API and injects them into dropdown
async function loadGenres() {
    try {
        const res = await fetch('/api/genres/');
        if (!res.ok) return;
        const genres = await res.json();
        const menu = document.getElementById('colGenreMenu');
        genres.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'col-filter-option';
            btn.dataset.filter = 'genre';
            btn.dataset.value = g.tmdb_id;
            btn.textContent = g.name;
            menu.appendChild(btn);
        });
        initGenreOptions();
    } catch {}
}

// Initializes dropdown behavior for all filter dropdowns
function initDropdowns() {
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        const btn = dropdown.querySelector('.filter-btn');

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');

            closeAllDropdowns();

            if (!isOpen) dropdown.classList.add('open');
        });
    });
    // Global click handler to close dropdowns when clicking outside
    document.addEventListener('click', e => {
        if (!e.target.closest('.filter-dropdown')) closeAllDropdowns();
    });
}

// Close all open dropdown menus
function closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown.open').forEach(d => d.classList.remove('open'));
}

// Shows or hides user-rating-related sort options
function updateRatingSection(tab) {
    const section = document.getElementById('userRatingSortOptions');
    if (section) {
        section.style.display = RATED_ONLY_TABS.has(tab) ? '' : 'none';
    }
}

// Initializes sorting dropdown options and binds click handlers
function initSortOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="sort"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.col-filter-option[data-filter="sort"]')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');

            state.sort = btn.dataset.value;

            document.getElementById('colSortLabel').textContent = btn.dataset.label;
            document.getElementById('colSortBtn').classList.add('active');

            closeAllDropdowns();
            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Initializes genre selection dropdown
function initGenreOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="genre"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.col-filter-option[data-filter="genre"]')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');

            state.genre_id = btn.dataset.value ? parseInt(btn.dataset.value) : null;

            document.getElementById('colGenreLabel').textContent =
                btn.dataset.value ? `Genre · ${btn.textContent.trim()}` : 'Genre';
            document.getElementById('colGenreBtn').classList.toggle('active', !!btn.dataset.value);

            closeAllDropdowns();
            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Initializes year filter and decade selection logic
function initYearOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="year"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            state.year = null;
            state.year_from = null;
            state.year_to = null;

            document.getElementById('colYearLabel').textContent = 'Year';
            document.getElementById('colYearBtn').classList.remove('active');

            removeYearSubmenu();
            closeAllDropdowns();
            renderActiveFilters();
            fetchCollection();
        });
    });
    // Decade selection buttons (e.g. 1990s, 2000s)
    document.querySelectorAll('.decade-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            showYearSubmenu(parseInt(btn.dataset.decade));
        });
    });
}

// Builds and displays a submenu with years inside selected decade
function showYearSubmenu(decade) {
    removeYearSubmenu();

    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = decade; y <= decade + 9 && y <= currentYear; y++) years.push(y);

    const submenu = document.createElement('div');
    submenu.className = 'year-submenu';
    submenu.id = 'colYearSubmenu';
    submenu.innerHTML = `
        <div class="year-submenu__header">
            <span class="year-submenu__title">Pick a year or</span>
            <button class="year-submenu__decade-btn">${decade}s</button>
        </div>
        <div class="year-submenu__grid">
            ${years.map(y => `<button class="year-option" data-year="${y}">${y}</button>`).join('')}
        </div>
    `;

    document.getElementById('colYearMenu').appendChild(submenu);

    // Select whole decade range
    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', e => {
        e.stopPropagation();
        state.year = null;
        state.year_from = decade;
        state.year_to = Math.min(decade + 9, currentYear);
        document.getElementById('colYearLabel').textContent = `Year · ${decade}s`;
        document.getElementById('colYearBtn').classList.add('active');
        closeAllDropdowns();
        renderActiveFilters();
        fetchCollection();
    });

    submenu.querySelectorAll('.year-option').forEach(yBtn => {
        yBtn.addEventListener('click', e => {
            e.stopPropagation();
            state.year = parseInt(yBtn.dataset.year);
            state.year_from = null;
            state.year_to = null;
            document.getElementById('colYearLabel').textContent = `Year · ${state.year}`;
            document.getElementById('colYearBtn').classList.add('active');
            closeAllDropdowns();
            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Removes the dynamically created year submenu
function removeYearSubmenu() {
    document.getElementById('colYearSubmenu')?.remove();
}

// Initializes runtime/duration filter dropdown
function initDurationOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="duration"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.col-filter-option[data-filter="duration"]')
                .forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            state.runtime_min = btn.dataset.min ? parseInt(btn.dataset.min) : null;
            state.runtime_max = btn.dataset.max ? parseInt(btn.dataset.max) : null;

            document.getElementById('colDurationLabel').textContent =
                btn.dataset.value ? `Duration · ${durationLabels[btn.dataset.value]}` : 'Duration';
            document.getElementById('colDurationBtn').classList.toggle('active', !!btn.dataset.value);

            closeAllDropdowns();
            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Initializes collection search input
function initSearch() {
    const input = document.getElementById('collectionSearch');
    const clear = document.getElementById('collectionSearchClear');
    let timer;

    input.addEventListener('input', () => {
        clear.style.display = input.value ? '' : 'none';
        clearTimeout(timer);
        timer = setTimeout(() => {
            state.search = input.value.trim();
            renderActiveFilters();
            fetchCollection();
        }, 300);
    });

    clear.addEventListener('click', () => {
        input.value = '';
        clear.style.display = 'none';
        state.search = '';
        renderActiveFilters();
        fetchCollection();
    });
}

// Renders active filter tags based on current state
function renderActiveFilters() {
    const container = document.getElementById('colActiveFilters');
    const resetBtn = document.getElementById('colResetFilters');
    const tags = [];

    if (state.sort !== 'added_desc') {
        const label = document.getElementById('colSortLabel').textContent;
        tags.push({ label, key: 'sort' });
    }
    if (state.genre_id) {
        tags.push({ label: document.getElementById('colGenreLabel').textContent, key: 'genre' });
    }
    if (state.year) tags.push({ label: `${state.year}`, key: 'year' });
    if (state.year_from) tags.push({ label: `${state.year_from}s`, key: 'decade' });
    if (state.runtime_min || state.runtime_max) {
        tags.push({ label: document.getElementById('colDurationLabel').textContent, key: 'duration' });
    }
    if (state.search) tags.push({ label: `"${state.search}"`, key: 'search' });

    // Render tags as HTML
    container.innerHTML = tags.map(t =>
        `<span class="active-filter-tag">${escapeHtml(t.label)}
            <button class="active-filter-tag__remove" data-key="${t.key}">×</button>
        </span>`
    ).join('');

    container.querySelectorAll('.active-filter-tag__remove').forEach(btn => {
        btn.addEventListener('click', () => removeFilter(btn.dataset.key));
    });

    resetBtn.style.display = tags.length ? '' : 'none';
}

// Removes a specific filter by key and resets related state + UI
function removeFilter(key) {
    if (key === 'sort') {
        state.sort = 'added_desc';
        document.getElementById('colSortLabel').textContent = 'Sort';
        document.getElementById('colSortBtn').classList.remove('active');
    }

    if (key === 'genre') {
        state.genre_id = null;
        document.getElementById('colGenreLabel').textContent = 'Genre';
        document.getElementById('colGenreBtn').classList.remove('active');
    }

    if (key === 'year') {
        state.year = null;
        document.getElementById('colYearLabel').textContent = 'Year';
        document.getElementById('colYearBtn').classList.remove('active');
        removeYearSubmenu();
    }

    if (key === 'decade') {
        state.year_from = null;
        state.year_to = null;
        document.getElementById('colYearLabel').textContent = 'Year';
        document.getElementById('colYearBtn').classList.remove('active');
        removeYearSubmenu();
    }

    if (key === 'duration') {
        state.runtime_min = null;
        state.runtime_max = null;
        document.getElementById('colDurationLabel').textContent = 'Duration';
        document.getElementById('colDurationBtn').classList.remove('active');
    }

    if (key === 'search') {
        state.search = '';
        document.getElementById('collectionSearch').value = '';
        document.getElementById('collectionSearchClear').style.display = 'none';
    }

    document.querySelectorAll('.col-filter-option.selected').forEach(b => b.classList.remove('selected'));

    renderActiveFilters();
    fetchCollection();
}

// Resets all filters to default state
function resetFilters(fetch = true) {
    state.sort = 'added_desc';
    state.genre_id = null;
    state.year = null;
    state.year_from = null;
    state.year_to = null;
    state.runtime_min = null;
    state.runtime_max = null;
    state.search = '';

    document.getElementById('colSortLabel').textContent = 'Sort';
    document.getElementById('colSortBtn').classList.remove('active');

    document.getElementById('colGenreLabel').textContent = 'Genre';
    document.getElementById('colGenreBtn').classList.remove('active');

    document.getElementById('colYearLabel').textContent = 'Year';
    document.getElementById('colYearBtn').classList.remove('active');

    document.getElementById('colDurationLabel').textContent = 'Duration';
    document.getElementById('colDurationBtn').classList.remove('active');

    document.getElementById('collectionSearch').value = '';
    document.getElementById('collectionSearchClear').style.display = 'none';

    // Clear selected options
    document.querySelectorAll('.col-filter-option.selected').forEach(b => b.classList.remove('selected'));

    // Restore default sort selection
    const defaultBtn = document.querySelector('.col-filter-option[data-filter="sort"][data-value="added_desc"]');
    if (defaultBtn) defaultBtn.classList.add('selected');

    removeYearSubmenu();
    renderActiveFilters();
    if (fetch) fetchCollection();
}

// HTML escaping to prevent XSS in rendered labels
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Initializes full collection page
async function init() {
    document.getElementById('collectionTitle').textContent = TAB_TITLES[ACTIVE_TAB];

    updateRatingSection(ACTIVE_TAB);

    // Sidebar navigation tab switching
    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const url = new URL(item.getAttribute('href'), window.location.origin);
            const tab = url.searchParams.get('tab');
            if (tab) switchTab(tab);
        });
    });

    // Reset button
    document.getElementById('colResetFilters').addEventListener('click', () => resetFilters(true));

    initDropdowns();
    initSortOptions();
    initYearOptions();
    initDurationOptions();
    initSearch();

    // Mark default sort option
    const defaultSortBtn = document.querySelector(`.col-filter-option[data-filter="sort"][data-value="${state.sort}"]`);
    if (defaultSortBtn) defaultSortBtn.classList.add('selected');

    await loadGenres();
    fetchCollection();
}

init();