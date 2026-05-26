// Tab titles displayed in the profile navigation
const TAB_TITLES = {
    want_to_watch: 'Want to Watch',
    watching: 'Watching',
    completed: 'Completed',
    dropped: 'Dropped',
    favorites: 'Favorites',
    lists: 'My Lists',
    liked_lists: 'Liked Lists',
};

// Base API path depends on whether the profile is public or current user
const _base = PROFILE_USERNAME ? `/api/users/${PROFILE_USERNAME}` : '/api/user';

// Film collection endpoints for each tab
const TAB_ENDPOINTS = {
    want_to_watch: `${_base}/films/want-to-watch`,
    watching:      `${_base}/films/watching`,
    completed:     `${_base}/films/completed`,
    dropped:       `${_base}/films/dropped`,
    favorites:     PROFILE_USERNAME ? `${_base}/favorites` : '/api/user/favorites/',
};

// Lists endpoints
const LISTS_ENDPOINT       = PROFILE_USERNAME ? `/api/users/${PROFILE_USERNAME}/lists` : '/api/user/lists/';
const LIKED_LISTS_ENDPOINT = '/api/user/lists/liked';

// Tabs that support rating-related filters
const RATED_ONLY_TABS      = new Set(['completed', 'favorites']);

// Shared collection filter and sorting state
const state = {
    tab: ACTIVE_TAB,
    sort: 'added_desc',
    genre_id: null,
    genre_name: null,
    year: null,
    year_from: null,
    year_to: null,
    upcoming: false,
    runtime_min: null,
    runtime_max: null,
    runtime_label: null,
    search: '',
};

// Labels for film sorting options
const SORT_LABELS = {
    added_desc:       'Sort · Newest added',
    added_asc:        'Sort · Oldest added',
    release_desc:     'Sort · Newest release',
    release_asc:      'Sort · Oldest release',
    rating_desc:      'Sort · Highest rated',
    rating_asc:       'Sort · Lowest rated',
    user_rating_desc: 'Sort · Your highest',
    user_rating_asc:  'Sort · Your lowest',
    rated_only:       'Sort · Rated only',
    unrated_only:     'Sort · Not rated',
    popularity_desc:  'Sort · Most popular',
    runtime_desc:     'Sort · Longest first',
    runtime_asc:      'Sort · Shortest first',
};

// Labels for runtime filters
const DURATION_LABELS = {
    short:    'Duration · Under 90 min',
    standard: 'Duration · 90–150 min',
    long:     'Duration · Over 150 min',
};

// Lists sort option labels shown IN the browse-bar button (for My Lists / Liked Lists)
const LISTS_SORT_LABELS = {
    updated_desc: 'SORT · Newest updated',
    updated_asc:  'SORT · Oldest updated',
    created_desc: 'SORT · Newest created',
    created_asc:  'SORT · Oldest created',
    name_asc:     'SORT · Name A–Z',
    name_desc:    'SORT · Name Z–A',
    films_desc:   'SORT · Most films',
    films_asc:    'SORT · Fewest films',
};

// Labels for liked lists sorting options
const LIKED_SORT_LABELS = {
    liked_desc:  'SORT · Newest liked',
    liked_asc:   'SORT · Oldest liked',
    likes_desc:  'SORT · Most liked',
    likes_asc:   'SORT · Least liked',
    views_desc:  'SORT · Most viewed',
    views_asc:   'SORT · Least viewed',
    films_desc:  'SORT · Most films',
    name_asc:    'SORT · Name A–Z',
};

// State for lists filters and sorting
const listsState = { sort: 'updated_desc', is_public: null, search: '' };

// Fetch films for the active collection tab
async function fetchCollection() {
    const grid  = document.getElementById('collectionGrid');
    const empty = document.getElementById('collectionEmpty');
    const count = document.getElementById('collectionCount');

    const privateMsg = document.getElementById('collectionPrivateMsg');
    if (privateMsg) privateMsg.style.display = 'none';

    renderSkeletons(); empty.style.display = 'none';
    const params = new URLSearchParams();

    // Upcoming filter replaces year filters
    if (state.genre_id)    params.set('genre_id', state.genre_id);
    if (state.upcoming) {
        params.set('upcoming', 'true');
    } else {
        if (state.year)        params.set('year', state.year);
        if (state.year_from)   params.set('year_from', state.year_from);
        if (state.year_to)     params.set('year_to', state.year_to);
    }

    // Apply runtime filters
    if (state.runtime_min) params.set('runtime_min', state.runtime_min);
    if (state.runtime_max) params.set('runtime_max', state.runtime_max);

    // Handle rated/unrated filters separately from regular sorting
    if (state.sort === 'rated_only') {
        params.set('rated_only', 'true');
    } else if (state.sort === 'unrated_only') {
        params.set('unrated_only', 'true');
    } else {
        params.set('sort', state.sort);
    }

    // Apply search query
    if (state.search) params.set('search', state.search);

    try {
        const res  = await fetch(`${TAB_ENDPOINTS[state.tab]}?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        const countEl = document.getElementById(`count-${state.tab}`);
        if (countEl) countEl.textContent = data.length;
        count.textContent = `${data.length} films`;

        if (!data.length) { grid.style.display = 'none'; empty.style.display = 'flex'; return; }
        grid.style.display = 'grid';
        grid.innerHTML = data.map(entry => renderCard(entry)).join('');
    } catch {
        grid.style.display = 'none'; empty.style.display = 'flex';
    }
}

// Render a single film card
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
                : `<div class="collection-card__no-poster"></div>`}
            <div class="collection-card__info">
                <p class="collection-card__title">${escapeHtml(film.title)}</p>
                <div class="collection-card__meta">${tmdbRating}${userRating}${year}</div>
            </div>
        </a>`;
}

// Fetch user's own lists
async function fetchLists() {
    const grid  = document.getElementById('listsGrid');
    const empty = document.getElementById('listsEmpty');
    const count = document.getElementById('collectionCount');

    grid.style.display = 'grid'; empty.style.display = 'none';
    renderListSkeletons(grid, 4);

    const params = new URLSearchParams();
    params.set('sort', listsState.sort);

    if (listsState.is_public !== null) params.set('is_public', listsState.is_public);
    if (listsState.search) params.set('search', listsState.search);

    try {
        const res  = await fetch(`${LISTS_ENDPOINT}?${params}`);
        if (!res.ok) throw new Error();

        const data = await res.json();
        const countEl = document.getElementById('count-lists');

        if (countEl) countEl.textContent = data.length;
        count.textContent = `${data.length} lists`;

        if (!data.length) { grid.style.display = 'none'; empty.style.display = 'flex'; return; }
        grid.style.display = 'grid';

        grid.innerHTML = data.map(list =>
            renderListCard(list, {
                showBadge: true, showDesc: true, showDate: true
            })
        ).join('');

    } catch {
        grid.style.display = 'none'; empty.style.display = 'flex';
    }
}

// Fetch lists liked by the current user
async function fetchLikedLists() {
    const grid  = document.getElementById('listsGrid');
    const empty = document.getElementById('listsEmpty');
    const count = document.getElementById('collectionCount');

    grid.style.display = 'grid'; empty.style.display = 'none';
    renderListSkeletons(grid, 4);

    const params = new URLSearchParams();
    params.set('sort', listsState.sort || 'liked_desc');

    if (listsState.search) params.set('search', listsState.search);

    try {
        const res  = await fetch(`${LIKED_LISTS_ENDPOINT}?${params}`);
        if (!res.ok) throw new Error();

        const data = await res.json();
        const countEl = document.getElementById('count-liked_lists');

        if (countEl) countEl.textContent = data.length;
        count.textContent = `${data.length} lists`;

        if (!data.length) { grid.style.display = 'none'; empty.style.display = 'flex'; return; }
        grid.style.display = 'grid';

        grid.innerHTML = data.map(list => renderListCard(list, {
            showAuthor: true, showDesc: true, showLikes: true, showViews: true,
        })).join('');
    } catch {
        grid.style.display = 'none'; empty.style.display = 'flex';
    }
}

// Render loading skeleton cards while collection data is being fetched
function renderSkeletons() {
    const grid = document.getElementById('collectionGrid');
    grid.style.display = 'grid';

    // Generate placeholder cards for loading state
    grid.innerHTML = Array(8).fill(`
        <div class="collection-card collection-card--skeleton">
            <div class="collection-card__poster skeleton-box"></div>
            <div class="collection-card__info">
                <div class="skeleton-box" style="height:14px;width:80%;margin-bottom:8px;"></div>
                <div class="skeleton-box" style="height:12px;width:50%;"></div>
            </div>
        </div>`).join('');
}

// Dropdown initialization (currently handled via CSS hover)
function initDropdowns() {
    /* browse-bar uses CSS hover */
}

// Highlight default filter selections in UI
function highlightDefaults() {
    const defSort = document.querySelector('.col-filter-option[data-filter="sort"][data-value="added_desc"]');
    if (defSort) defSort.classList.add('selected');

    const defGenre = document.querySelector('.col-filter-option[data-filter="genre"][data-value=""]');
    if (defGenre) defGenre.classList.add('selected');

    const defYear = document.querySelector('.col-filter-option[data-filter="year"][data-value=""]');
    if (defYear) defYear.classList.add('selected');

    const defDur = document.querySelector('.col-filter-option[data-filter="duration"][data-value=""]');
    if (defDur) defDur.classList.add('selected');
}

// Initialize sorting options for collection tab
function initSortOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="sort"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            // Update selected UI state
            document.querySelectorAll('.col-filter-option[data-filter="sort"]')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');
            state.sort = btn.dataset.value;

            // Status/Favorites: button stays highlighted, label stays "SORT"
            document.getElementById('colSortBtn').classList.toggle('active', state.sort !== 'added_desc');

            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Initialize genre filter options
function initGenreOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="genre"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.col-filter-option[data-filter="genre"]')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');

            state.genre_id   = btn.dataset.value ? parseInt(btn.dataset.value) : null;
            state.genre_name = btn.dataset.value ? btn.textContent.trim() : null;

            document.getElementById('colGenreBtn').classList.toggle('active', !!btn.dataset.value);

            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Initialize year filter options
function initYearOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="upcoming"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.col-filter-option[data-filter="year"]')
                .forEach(b => b.classList.remove('selected'));

            state.year = null;
            state.year_from = null;
            state.year_to = null;
            state.upcoming = true;

            document.getElementById('colYearBtn').classList.add('active');

            removeYearSubmenu();
            renderActiveFilters();
            fetchCollection();
        });
    });

    // Decade selection (opens year submenu)
    document.querySelectorAll('.decade-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            showYearSubmenu(parseInt(btn.dataset.decade));
        });
    });
}

// Create dynamic submenu for selecting specific years within a decade
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
        </div>`;

    document.getElementById('colYearMenu').appendChild(submenu);

    // Select full decade range instead of single year
    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', e => {
        e.stopPropagation();

        state.year = null;
        state.upcoming = false;
        state.year_from = decade;
        state.year_to = Math.min(decade + 9, currentYear);

        document.getElementById('colYearBtn').classList.add('active');

        renderActiveFilters();
        fetchCollection();
    });

    // Select specific year
    submenu.querySelectorAll('.year-option').forEach(yBtn => {
        yBtn.addEventListener('click', e => {
            e.stopPropagation();

            state.year = parseInt(yBtn.dataset.year);
            state.year_from = null;
            state.year_to = null;
            state.upcoming = false;

            document.getElementById('colYearBtn').classList.add('active');

            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Remove year submenu from DOM
function removeYearSubmenu() {
    document.getElementById('colYearSubmenu')?.remove();
}

// Initialize duration filter options
function initDurationOptions() {
    document.querySelectorAll('.col-filter-option[data-filter="duration"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.col-filter-option[data-filter="duration"]')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');

            // Update runtime filters
            state.runtime_min   = btn.dataset.min ? parseInt(btn.dataset.min) : null;
            state.runtime_max   = btn.dataset.max ? parseInt(btn.dataset.max) : null;
            state.runtime_label = btn.dataset.value ? DURATION_LABELS[btn.dataset.value] : null;

            document.getElementById('colDurationBtn').classList.toggle('active', !!btn.dataset.value);

            renderActiveFilters();
            fetchCollection();
        });
    });
}

// Initialize search input with debounce
function initSearch() {
    const input = document.getElementById('collectionSearch');
    const clear = document.getElementById('collectionSearchClear');

    if (!input) return;
    let timer;

    input.addEventListener('input', () => {
        clear.style.display = input.value ? '' : 'none';
        clearTimeout(timer);

        // Debounced search request
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

// Load genres dynamically from API and rebuild genre menu
async function loadGenres() {
    try {
        const res = await fetch('/api/genres/');
        if (!res.ok) return;

        const genres = await res.json();
        const menu = document.getElementById('colGenreMenu');

        if (!menu) return;

        // Remove previously injected genre options
        menu.querySelectorAll('.col-filter-option[data-filter="genre"]:not([data-value=""])')
            .forEach(el => el.remove());

        // Append genres from API
        genres.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'col-filter-option';
            btn.dataset.filter = 'genre'; btn.dataset.value = g.tmdb_id;
            btn.textContent = g.name;

            menu.appendChild(btn);
        });
        initGenreOptions();
    } catch {}
}

// Renders active filter chips based on current state
function renderActiveFilters() {
    const container = document.getElementById('colActiveFilters');
    const resetBtn  = document.getElementById('colResetFilters');
    const bar       = document.getElementById('colActiveFiltersBar');
    if (!container) return;

    const tags = [];

    // Build active filter tags dynamically from state
    if (state.sort !== 'added_desc')
        tags.push({ label: SORT_LABELS[state.sort] || 'Sort', key: 'sort' });

    if (state.genre_id && state.genre_name)
        tags.push({ label: `Genre · ${state.genre_name}`, key: 'genre' });

    if (state.upcoming)
        tags.push({ label: 'Year · Upcoming', key: 'upcoming' });

    if (state.year)
        tags.push({ label: `Year · ${state.year}`, key: 'year' });

    if (state.year_from)
        tags.push({ label: `Year · ${state.year_from}s`, key: 'decade' });

    if (state.runtime_label)
        tags.push({ label: state.runtime_label, key: 'duration' });

    if (state.search)
        tags.push({ label: `Search · ${state.search}`, key: 'search' });

    // Render chips
    container.innerHTML = tags.map(t =>
        `<span class="active-filter-tag">${escapeHtml(t.label)}
            <button class="active-filter-tag__remove" data-key="${t.key}">×</button>
        </span>`
    ).join('');

    // Attach remove handlers for each chip
    container.querySelectorAll('.active-filter-tag__remove').forEach(btn => {
        btn.addEventListener('click', () => removeFilter(btn.dataset.key));
    });

    // Toggle reset button and empty state styling
    if (resetBtn) resetBtn.style.display = tags.length ? '' : 'none';
    if (bar) bar.classList.toggle('col-active-filters-bar--empty', tags.length === 0);
}

// Remove a single filter and sync UI + state
function removeFilter(key) {
    if (key === 'sort') {
        state.sort = 'added_desc';
        document.getElementById('colSortBtn')?.classList.remove('active');

        document.querySelectorAll('.col-filter-option[data-filter="sort"]')
            .forEach(b => {
                b.classList.remove('selected');
                if (b.dataset.value === 'added_desc') b.classList.add('selected');
            });
    }

    if (key === 'genre') {
        state.genre_id = null;
        state.genre_name = null;

        document.getElementById('colGenreBtn')?.classList.remove('active');

        document.querySelectorAll('.col-filter-option[data-filter="genre"]')
            .forEach(b => {
                b.classList.remove('selected');
                if (!b.dataset.value) b.classList.add('selected');
            });
    }

    if (key === 'upcoming') {
        state.upcoming = false;

        document.getElementById('colYearBtn')?.classList.remove('active');

        document.querySelectorAll('.col-filter-option[data-filter="upcoming"]')
            .forEach(b => b.classList.remove('selected'));

        document.querySelectorAll('.col-filter-option[data-filter="year"]')
            .forEach(b => {
                if (!b.dataset.value) b.classList.add('selected');
            });
    }

    if (key === 'year') {
        state.year = null;

        document.getElementById('colYearBtn')?.classList.remove('active');

        removeYearSubmenu();

        document.querySelectorAll('.col-filter-option[data-filter="year"]')
            .forEach(b => {
                if (!b.dataset.value) b.classList.add('selected');
            });
    }

    if (key === 'decade') {
        state.year_from = null;
        state.year_to = null;

        document.getElementById('colYearBtn')?.classList.remove('active');

        removeYearSubmenu();

        document.querySelectorAll('.decade-btn')
            .forEach(b => b.classList.remove('selected'));
    }

    if (key === 'duration') {
        state.runtime_min = null;
        state.runtime_max = null;
        state.runtime_label = null;

        document.getElementById('colDurationBtn')?.classList.remove('active');

        document.querySelectorAll('.col-filter-option[data-filter="duration"]')
            .forEach(b => {
                b.classList.remove('selected');
                if (!b.dataset.value) b.classList.add('selected');
            });
    }

    if (key === 'search') {
        state.search = '';

        const i = document.getElementById('collectionSearch');
        const c = document.getElementById('collectionSearchClear');

        if (i) i.value = '';
        if (c) c.style.display = 'none';
    }

    renderActiveFilters();
    fetchCollection();
}

function resetFilters(doFetch = true) {
    state.sort = 'added_desc';
    state.genre_id = null;
    state.genre_name = null;

    state.year = null;
    state.year_from = null;
    state.year_to = null;

    state.upcoming = false;
    state.runtime_min = null;
    state.runtime_max = null;
    state.runtime_label = null; state.search = '';

    // Reset UI buttons
    document.getElementById('colSortBtn')?.classList.remove('active');
    document.getElementById('colGenreBtn')?.classList.remove('active');
    document.getElementById('colYearBtn')?.classList.remove('active');
    document.getElementById('colDurationBtn')?.classList.remove('active');

    // Reset search input
    const si = document.getElementById('collectionSearch');
    const sc = document.getElementById('collectionSearchClear');
    if (si) si.value = ''; if (sc) sc.style.display = 'none';

    // Clear selected filter options
    document.querySelectorAll('.col-filter-option.selected')
        .forEach(b => b.classList.remove('selected'));

    highlightDefaults();
    removeYearSubmenu();
    renderActiveFilters();

    if (doFetch) fetchCollection();
}

// Renders "My Lists" filter bar and binds UI events
function renderListsFilters() {

    // Reset local list filter state when entering tab
    listsState.sort = 'updated_desc';
    listsState.is_public = null;
    listsState.search = '';

    // Inject full filter UI into container
    document.getElementById('collectionFilters').innerHTML = `
        <div class="lists-filters-row">
            <div class="col-browse-bar" style="overflow:visible;">
                <span class="col-browse-bar__label">Browse by</span>
                <div class="col-browse-bar__divider"></div>
                <div class="col-browse-bar__item">
                    <button class="col-browse-bar__btn" id="listsSortBtn">
                        <span id="listsSortLabel">SORT · Newest updated</span>
                        <svg class="col-browse-bar__arrow" viewBox="0 0 10 6" fill="none">
                            <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <div class="col-browse-bar__menu col-browse-bar__menu--sort">
                        <div class="col-browse-bar__section">Last updated</div>
                        <button class="lists-sort-option selected" data-value="updated_desc" data-label="SORT · Newest updated">Newest updated</button>
                        <button class="lists-sort-option" data-value="updated_asc"  data-label="SORT · Oldest updated">Oldest updated</button>
                        <div class="col-browse-bar__section">Created</div>
                        <button class="lists-sort-option" data-value="created_desc" data-label="SORT · Newest created">Newest created</button>
                        <button class="lists-sort-option" data-value="created_asc"  data-label="SORT · Oldest created">Oldest created</button>
                        <div class="col-browse-bar__section">Other</div>
                        <button class="lists-sort-option" data-value="name_asc"   data-label="SORT · Name A–Z">Name A–Z</button>
                        <button class="lists-sort-option" data-value="name_desc"  data-label="SORT · Name Z–A">Name Z–A</button>
                        <button class="lists-sort-option" data-value="films_desc" data-label="SORT · Most films">Most films</button>
                        <button class="lists-sort-option" data-value="films_asc"  data-label="SORT · Fewest films">Fewest films</button>
                    </div>
                </div>
            </div>
            ${IS_OWNER ? `
            <div class="lists-visibility-toggle">
                <button class="lists-vis-btn lists-vis-btn--active" data-value="">All</button>
                <button class="lists-vis-btn" data-value="false">Private</button>
                <button class="lists-vis-btn" data-value="true">Public</button>
            </div>
            <button class="cl-new-list-btn" id="clNewListBtn">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                New list
            </button>` : ''}
            <div class="col-browse-search" style="margin-left:auto;">
                <span class="col-browse-search__icon">⌕</span>
                <input type="text" class="col-browse-search__input" id="listsSearch" placeholder="Search lists..." autocomplete="off">
                <button class="col-browse-search__clear" id="listsSearchClear" style="display:none">×</button>
            </div>
        </div>
        <div class="lists-filters-divider"></div>`;

    // Sort option click handling
    document.querySelectorAll('.lists-sort-option').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            // Update UI selected state
            document.querySelectorAll('.lists-sort-option')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');
            listsState.sort = btn.dataset.value;

            // Update label inside button (shows current sort)
            document.getElementById('listsSortLabel').textContent =
                btn.dataset.label || btn.textContent.trim();

            fetchLists();
        });
    });

    // Visibility filter (all / private / public)
    document.querySelectorAll('.lists-vis-btn').forEach(btn => {
        btn.addEventListener('click', () => {

            document.querySelectorAll('.lists-vis-btn')
                .forEach(b => b.classList.remove('lists-vis-btn--active'));

            btn.classList.add('lists-vis-btn--active');

            // Convert dataset value into boolean/null filter
            listsState.is_public =
                btn.dataset.value === '' ? null : btn.dataset.value === 'true';

            fetchLists();
        });
    });

    // Search input with debounce
    const si = document.getElementById('listsSearch');
    const sc = document.getElementById('listsSearchClear');

    let t;

    si.addEventListener('input', () => {
        listsState.search = si.value.trim();
        sc.style.display = listsState.search ? '' : 'none';
        clearTimeout(t);
        t = setTimeout(fetchLists, 300);
    });

    sc.addEventListener('click', () => {
        si.value = '';
        listsState.search = '';
        sc.style.display = 'none';
        fetchLists();
    });

    if (IS_OWNER) initCreateListModal();
}

// Same structure as "My Lists" but without visibility filter
function renderLikedListsFilters() {
    listsState.sort = 'liked_desc';
    listsState.search = '';

    document.getElementById('collectionFilters').innerHTML = `
        <div class="lists-filters-row">
            <div class="col-browse-bar" style="overflow:visible;">
                <span class="col-browse-bar__label">Browse by</span>
                <div class="col-browse-bar__divider"></div>
                <div class="col-browse-bar__item">
                    <button class="col-browse-bar__btn" id="likedSortBtn">
                        <span id="likedSortLabel">SORT · Newest liked</span>
                        <svg class="col-browse-bar__arrow" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                    <div class="col-browse-bar__menu col-browse-bar__menu--sort">
                        <div class="col-browse-bar__section">Date liked</div>
                        <button class="liked-sort-option selected" data-value="liked_desc" data-label="SORT · Newest liked">Newest liked</button>
                        <button class="liked-sort-option" data-value="liked_asc"  data-label="SORT · Oldest liked">Oldest liked</button>
                        <div class="col-browse-bar__section">Likes</div>
                        <button class="liked-sort-option" data-value="likes_desc" data-label="SORT · Most liked">Most liked</button>
                        <button class="liked-sort-option" data-value="likes_asc"  data-label="SORT · Least liked">Least liked</button>
                        <div class="col-browse-bar__section">Views</div>
                        <button class="liked-sort-option" data-value="views_desc" data-label="SORT · Most viewed">Most viewed</button>
                        <button class="liked-sort-option" data-value="views_asc"  data-label="SORT · Least viewed">Least viewed</button>
                        <div class="col-browse-bar__section">Other</div>
                        <button class="liked-sort-option" data-value="films_desc" data-label="SORT · Most films">Most films</button>
                        <button class="liked-sort-option" data-value="name_asc"   data-label="SORT · Name A–Z">Name A–Z</button>
                    </div>
                </div>
            </div>
            <div class="col-browse-search" style="margin-left:auto;">
                <span class="col-browse-search__icon">⌕</span>
                <input type="text" class="col-browse-search__input" id="listsSearch" placeholder="Search liked lists..." autocomplete="off">
                <button class="col-browse-search__clear" id="listsSearchClear" style="display:none">×</button>
            </div>
        </div>
        <div class="lists-filters-divider"></div>`;

    // Sort handling
    document.querySelectorAll('.liked-sort-option').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();

            document.querySelectorAll('.liked-sort-option')
                .forEach(b => b.classList.remove('selected'));

            btn.classList.add('selected');
            listsState.sort = btn.dataset.value;

            document.getElementById('likedSortLabel').textContent =
                btn.dataset.label || btn.textContent.trim();

            fetchLikedLists();
        });
    });

    // Search handling (debounced)
    const si = document.getElementById('listsSearch');
    const sc = document.getElementById('listsSearchClear');

    let t;

    si.addEventListener('input', () => {
        listsState.search = si.value.trim();
        sc.style.display = listsState.search ? '' : 'none';
        clearTimeout(t);
        t = setTimeout(fetchLikedLists, 300);
    });

    sc.addEventListener('click', () => {
        si.value = '';
        listsState.search = '';
        sc.style.display = 'none';
        fetchLikedLists();
    });
}

// Creates and manages the "New list" modal on the My Lists tab
function initCreateListModal() {
    const btn = document.getElementById('clNewListBtn');
    if (!btn) return;

    // Build modal once, reuse on subsequent tab visits
    let overlay = document.getElementById('clCreateListOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'clCreateListOverlay';
        overlay.className = 'atl-overlay';
        overlay.innerHTML = `
            <div class="atl-modal" style="max-height: unset;">
                <div class="atl-modal__header">
                    <span class="atl-modal__title">New list</span>
                    <button class="atl-modal__close" id="clModalClose">✕</button>
                </div>
                <div class="atl-create-form" style="padding: 16px 20px 24px; border-top: none;">
                    <input class="atl-input" id="clListName" type="text"
                        placeholder="List name" maxlength="255" autocomplete="off">
                    <textarea class="atl-input atl-textarea" id="clListDesc"
                        placeholder="Description (optional)" maxlength="475" rows="3"></textarea>
                    <div class="atl-create-form__actions">
                        <label class="atl-toggle-row">
                            <span>Public</span>
                            <div class="atl-toggle" id="clPublicToggle" data-on="false">
                                <div class="atl-toggle__knob"></div>
                            </div>
                        </label>
                        <div class="atl-create-form__btns">
                            <button class="atl-btn atl-btn--ghost" id="clCancelBtn">Cancel</button>
                            <button class="atl-btn atl-btn--primary" id="clConfirmBtn">Create</button>
                        </div>
                    </div>
                    <p id="clCreateError" style="display:none;font-size:12px;color:#e05c7a;margin-top:8px;"></p>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Toggle public/private
        document.getElementById('clPublicToggle').addEventListener('click', function () {
            this.dataset.on = this.dataset.on === 'true' ? 'false' : 'true';
        });

        // Close on backdrop click
        overlay.addEventListener('click', e => { if (e.target === overlay) closeCreateModal(); });
    }

    function openCreateModal() {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        document.getElementById('clListName').value = '';
        document.getElementById('clListDesc').value = '';
        document.getElementById('clPublicToggle').dataset.on = 'false';
        document.getElementById('clCreateError').style.display = 'none';
        document.getElementById('clConfirmBtn').disabled = false;
        document.getElementById('clConfirmBtn').textContent = 'Create';
        setTimeout(() => document.getElementById('clListName').focus({ preventScroll: true }), 50);
    }

    function closeCreateModal() {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    btn.addEventListener('click', openCreateModal);
    document.getElementById('clModalClose').addEventListener('click', closeCreateModal);
    document.getElementById('clCancelBtn').addEventListener('click', closeCreateModal);

    document.getElementById('clConfirmBtn').addEventListener('click', async () => {
        const name     = document.getElementById('clListName').value.trim();
        const desc     = document.getElementById('clListDesc').value.trim() || null;
        const isPublic = document.getElementById('clPublicToggle').dataset.on === 'true';
        const errEl    = document.getElementById('clCreateError');
        const confirmBtn = document.getElementById('clConfirmBtn');

        if (!name) { document.getElementById('clListName').focus({ preventScroll: true }); return; }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creating…';
        errEl.style.display = 'none';

        try {
            const res = await fetch('/api/user/lists/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: desc, is_public: isPublic }),
            });

            if (!res.ok) throw new Error();

            closeCreateModal();
            fetchLists();

        } catch {
            errEl.textContent = 'Something went wrong. Try again.';
            errEl.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Create';
        }
    });
}

// Shows or hides rating-related UI depending on active tab
function updateRatingSection(tab) {
    const s = document.getElementById('userRatingSortOptions');
    if (s) s.style.display = RATED_ONLY_TABS.has(tab) ? '' : 'none';
}

// Redirects back to default collection view while preserving current tab
function restoreCollectionFilters() {
    const base = IS_OWNER ? '/collection' : `/users/${PROFILE_USERNAME}/collection`;
    window.location.href = `${base}?tab=${state.tab}`;
}

// Handles switching between collection tabs (films, lists, liked lists, etc.)
function switchTab(tab) {
    if (!IS_OWNER && !PRIVACY[tab]) { showPrivateTab(tab); return; }

    const prevEl = document.getElementById(`count-${state.tab}`);
    if (prevEl) prevEl.textContent = '—';

    state.tab = tab;

    document.getElementById('collectionTitle').textContent = TAB_TITLES[tab] || tab;

    // Update active nav item
    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        item.classList.toggle('collection-nav__item--active', item.getAttribute('href').includes(`tab=${tab}`));
    });

    // Sync URL with current tab
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);

    const isLists = tab === 'lists' || tab === 'liked_lists';

    // Toggle main vs lists UI
    document.getElementById('collectionGrid').style.display = isLists ? 'none' : '';
    document.getElementById('collectionEmpty').style.display = 'none';
    document.getElementById('listsGrid').style.display = isLists ? 'grid' : 'none';
    document.getElementById('listsEmpty').style.display = 'none';

    // Load appropriate data source per tab
    if (tab === 'liked_lists') { renderLikedListsFilters(); fetchLikedLists(); }
    else if (tab === 'lists')  { renderListsFilters(); fetchLists(); }
    else { restoreCollectionFilters(); updateRatingSection(tab); }
}

// Shows private placeholder when user has no access to a tab
function showPrivateTab(tab) {
    state.tab = tab;

    document.getElementById('collectionTitle').textContent = TAB_TITLES[tab] || tab;

    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        item.classList.toggle('collection-nav__item--active', item.getAttribute('href').includes(`tab=${tab}`));
    });

    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);

    // Hide all main content sections
    ['collectionGrid','listsGrid','collectionEmpty','listsEmpty']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

    document.getElementById('collectionCount').textContent = '';

    // Render private message if missing
    let pm = document.getElementById('collectionPrivateMsg');
    if (!pm) {
        pm = document.createElement('div');
        pm.id = 'collectionPrivateMsg';
        pm.className = 'collection-private-msg';
        document.querySelector('.collection-main').appendChild(pm);
    }

    pm.style.display = 'flex';
    pm.innerHTML = `<span class="collection-private-msg__icon">🔒</span><p class="collection-private-msg__text">This section is private</p>`;
}

// Basic HTML escaping to prevent XSS in dynamic content rendering
function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

// Initializes collection page: sets up correct tab, filters, and data loading
async function init() {
    document.getElementById('collectionTitle').textContent = TAB_TITLES[ACTIVE_TAB];

    if (!IS_OWNER && !PRIVACY[ACTIVE_TAB]) { showPrivateTab(ACTIVE_TAB); return; }

    // Lists tab
    if (ACTIVE_TAB === 'lists') {
        document.getElementById('collectionGrid').style.display = 'none';
        document.getElementById('listsGrid').style.display = 'grid';

        renderListsFilters();
        updateRatingSection(ACTIVE_TAB);

        document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
            item.classList.toggle('collection-nav__item--active', item.getAttribute('href').includes('tab=lists'));
        });

        fetchLists();

    } else if (ACTIVE_TAB === 'liked_lists') {
        document.getElementById('collectionGrid').style.display = 'none';
        document.getElementById('listsGrid').style.display = 'grid';

        renderLikedListsFilters();
        updateRatingSection(ACTIVE_TAB);

        document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
            item.classList.toggle('collection-nav__item--active', item.getAttribute('href').includes('tab=liked_lists'));
        });

        fetchLikedLists();

    } else {
        updateRatingSection(ACTIVE_TAB);
        document.getElementById('colResetFilters')?.addEventListener('click', () => resetFilters(true));

        initDropdowns();
        initSortOptions();
        initYearOptions();
        initDurationOptions();
        initSearch();

        highlightDefaults();
        await loadGenres();

        fetchCollection();
    }

    // Navigation click handling for SPA-like tab switching
    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const tab = new URL(item.getAttribute('href'), window.location.origin)
                .searchParams.get('tab');

            if (tab) switchTab(tab);
        });
    });
}

init();