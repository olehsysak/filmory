// Titles for each collection tab
const TAB_TITLES = {
    want_to_watch: 'Want to Watch',
    watching: 'Watching',
    completed: 'Completed',
    dropped: 'Dropped',
    favorites: 'Favorites',
    lists: 'My Lists',
    liked_lists: 'Liked Lists',
};

// API endpoints mapped to each tab
const _base = PROFILE_USERNAME
    ? `/api/users/${PROFILE_USERNAME}`
    : '/api/user';

const TAB_ENDPOINTS = {
    want_to_watch: `${_base}/films/want-to-watch`,
    watching:      `${_base}/films/watching`,
    completed:     `${_base}/films/completed`,
    dropped:       `${_base}/films/dropped`,
    favorites:     PROFILE_USERNAME ? `${_base}/favorites` : '/api/user/favorites/',
};

const LISTS_ENDPOINT = PROFILE_USERNAME
    ? `/api/users/${PROFILE_USERNAME}/lists`
    : '/api/user/lists/';

const LIKED_LISTS_ENDPOINT = '/api/user/lists/liked';

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

// Separate filter state used only for custom user lists tab
const listsState = {
    sort: 'updated_desc',
    is_public: null,   // null | true | false
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

    // Hide private message if visible
    const privateMsg = document.getElementById('collectionPrivateMsg');
    if (privateMsg) privateMsg.style.display = 'none';

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

// Fetches user-created lists from the API and renders them into the lists grid
async function fetchLists() {
    const grid = document.getElementById('listsGrid');
    const empty = document.getElementById('listsEmpty');
    const count = document.getElementById('collectionCount');

    // Hide private message if visible
    const privateMsg = document.getElementById('collectionPrivateMsg');
    if (privateMsg) privateMsg.style.display = 'none';

    // Skeleton
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = Array(4).fill(`
        <div class="list-card list-card--skeleton">
            <div class="list-card__cover skeleton-box"></div>
            <div class="list-card__info">
                <div class="skeleton-box" style="height:14px;width:75%;margin-bottom:8px;"></div>
                <div class="skeleton-box" style="height:12px;width:45%;"></div>
            </div>
        </div>
    `).join('');

    const params = new URLSearchParams();
    params.set('sort', listsState.sort);
    if (listsState.is_public !== null) params.set('is_public', listsState.is_public);
    if (listsState.search) params.set('search', listsState.search);

    try {
        const res = await fetch(`${LISTS_ENDPOINT}?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        const countEl = document.getElementById('count-lists');
        if (countEl) countEl.textContent = data.length;
        count.textContent = `${data.length} lists`;

        if (!data.length) {
            grid.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = data.map(renderListCard).join('');
    } catch {
        grid.style.display = 'none';
        empty.style.display = 'flex';
    }
}

// Renders a single custom user list card
function renderListCard(list) {
    const badge = list.is_public
        ? '<span class="list-card__badge list-card__badge--public">Public</span>'
        : '<span class="list-card__badge list-card__badge--private">Private</span>';

    const updated = new Date(list.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
    });

    const covers = list.cover_urls && list.cover_urls.length > 0
        ? list.cover_urls
        : (list.cover_url ? [list.cover_url] : []);

    const coverHtml = covers.length > 0
        ? [
            ...covers.map(url => `<img src="${url}" alt="" loading="lazy">`),
            ...Array(Math.max(0, 5 - covers.length)).fill(`<div class="list-card__cover-empty"></div>`)
          ].join('')
        : '<div class="list-card__cover-placeholder"></div>';

    return `
        <a href="/list/${list.id}" class="list-card">
            <div class="list-card__cover list-card__cover--grid" data-count="${covers.length}">
                ${coverHtml}
                ${badge}
            </div>
            <div class="list-card__info">
                <p class="list-card__name">${escapeHtml(list.name)}</p>
                <p class="list-card__meta">${list.film_count} films · ${updated}</p>
                ${list.description
                    ? `<p class="list-card__desc">${escapeHtml(list.description)}</p>`
                    : ''
                }
            </div>
        </a>
    `;
}

// Fetches liked lists from the API and renders them
async function fetchLikedLists() {
    const grid = document.getElementById('listsGrid');
    const empty = document.getElementById('listsEmpty');
    const count = document.getElementById('collectionCount');

    const privateMsg = document.getElementById('collectionPrivateMsg');
    if (privateMsg) privateMsg.style.display = 'none';

    // Skeleton
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = Array(4).fill(`
        <div class="list-card list-card--skeleton">
            <div class="list-card__cover skeleton-box"></div>
            <div class="list-card__info">
                <div class="skeleton-box" style="height:14px;width:75%;margin-bottom:8px;"></div>
                <div class="skeleton-box" style="height:12px;width:45%;"></div>
            </div>
        </div>
    `).join('');

    try {
        const res = await fetch(LIKED_LISTS_ENDPOINT);
        if (!res.ok) throw new Error();
        const data = await res.json();

        const countEl = document.getElementById('count-liked_lists');
        if (countEl) countEl.textContent = data.length;
        count.textContent = `${data.length} lists`;

        if (!data.length) {
            grid.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = data.map(renderLikedListCard).join('');
    } catch {
        grid.style.display = 'none';
        empty.style.display = 'flex';
    }
}

// Renders a single liked list card (shows author, not owner controls)
function renderLikedListCard(list) {
    const covers = list.cover_urls || [];
    const slots = covers.slice(0, 5);
    const placeholders = Math.max(0, 5 - slots.length);
    const coverHtml = [
        ...slots.map(url => `<img src="${escapeHtml(url)}" alt="" loading="lazy" class="list-card__cover-img">`),
        ...Array(placeholders).fill('<div class="list-card__cover-placeholder"></div>'),
    ].join('');

    const likes = list.likes_count
        ? `<span class="list-card__stat">♥ ${list.likes_count}</span>`
        : '';

    return `
        <a href="/list/${list.id}" class="list-card">
            <div class="list-card__cover list-card__cover--grid" data-count="${covers.length}">
                ${coverHtml}
            </div>
            <div class="list-card__info">
                <p class="list-card__name">${escapeHtml(list.name)}</p>
                <p class="list-card__author">by ${escapeHtml(list.author_username)}</p>
                ${list.description
                    ? `<p class="list-card__desc">${escapeHtml(list.description)}</p>`
                    : ''
                }
                <div class="list-card__meta">
                    <span class="list-card__stat">${list.film_count} films</span>
                    ${likes}
                </div>
            </div>
        </a>
    `;
}

// Renders minimal filters for liked lists tab (search only, no sort needed for now)
function renderLikedListsFilters() {
    const filtersArea = document.getElementById('collectionFilters');
    filtersArea.innerHTML = `
        <div class="lists-filters">
            <div class="collection-search">
                <span class="collection-search__icon">⌕</span>
                <input type="text" class="collection-search__input" id="likedListsSearch"
                    placeholder="Search liked lists..." autocomplete="off">
                <button class="collection-search__clear" id="likedListsSearchClear" style="display:none">×</button>
            </div>
        </div>
    `;

    // Client-side search (filter already loaded cards)
    const searchInput = document.getElementById('likedListsSearch');
    const searchClear = document.getElementById('likedListsSearchClear');

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        searchClear.style.display = q ? '' : 'none';

        document.querySelectorAll('#listsGrid .list-card').forEach(card => {
            const name = card.querySelector('.list-card__name')?.textContent.toLowerCase() || '';
            const author = card.querySelector('.list-card__author')?.textContent.toLowerCase() || '';
            card.style.display = (name.includes(q) || author.includes(q)) ? '' : 'none';
        });
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        document.querySelectorAll('#listsGrid .list-card').forEach(card => {
            card.style.display = '';
        });
    });
}

// Renders and initializes filters used specifically for custom user lists
function renderListsFilters() {
    const filtersArea = document.getElementById('collectionFilters');
    filtersArea.innerHTML = `
        <div class="lists-filters">
            <div class="collection-search">
                <span class="collection-search__icon">⌕</span>
                <input type="text" class="collection-search__input" id="listsSearch"
                    placeholder="Search lists..." autocomplete="off">
                <button class="collection-search__clear" id="listsSearchClear" style="display:none">×</button>
            </div>
            <div class="collection-filters__row">
                <div class="filter-dropdown" id="listsSortDropdown">
                    <button class="filter-btn" id="listsSortBtn">
                        <span id="listsSortLabel">Sort</span>
                        <span class="filter-btn__arrow">▾</span>
                    </button>
                    <div class="filter-dropdown__menu">
                        <div class="filter-dropdown__section">Last updated</div>
                        <button class="lists-sort-option" data-value="updated_desc" data-label="Updated · Newest">Newest updated</button>
                        <button class="lists-sort-option" data-value="updated_asc" data-label="Updated · Oldest">Oldest updated</button>
                        <div class="filter-dropdown__section">Created</div>
                        <button class="lists-sort-option" data-value="created_desc" data-label="Created · Newest">Newest created</button>
                        <button class="lists-sort-option" data-value="created_asc" data-label="Created · Oldest">Oldest created</button>
                        <div class="filter-dropdown__section">Other</div>
                        <button class="lists-sort-option" data-value="name_asc" data-label="Name · A–Z">Name A–Z</button>
                        <button class="lists-sort-option" data-value="name_desc" data-label="Name · Z–A">Name Z–A</button>
                        <button class="lists-sort-option" data-value="films_desc" data-label="Films · Most">Most films</button>
                        <button class="lists-sort-option" data-value="films_asc" data-label="Films · Fewest">Fewest films</button>
                    </div>
                </div>

                ${IS_OWNER ? `
                    <div class="lists-visibility-toggle">
                        <button class="lists-vis-btn lists-vis-btn--active" data-value="">All</button>
                        <button class="lists-vis-btn" data-value="false">Private</button>
                        <button class="lists-vis-btn" data-value="true">Public</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Sort dropdown
    const sortDropdown = document.getElementById('listsSortDropdown');
    sortDropdown.querySelector('.filter-btn').addEventListener('click', e => {
        e.stopPropagation();
        sortDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => sortDropdown.classList.remove('open'));

    document.querySelectorAll('.lists-sort-option').forEach(btn => {
        if (btn.dataset.value === listsState.sort) btn.classList.add('selected');
        btn.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.lists-sort-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            listsState.sort = btn.dataset.value;
            document.getElementById('listsSortLabel').textContent = btn.dataset.label;
            document.getElementById('listsSortBtn').classList.add('active');
            sortDropdown.classList.remove('open');
            fetchLists();
        });
    });

    // Visibility toggle
    document.querySelectorAll('.lists-vis-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lists-vis-btn').forEach(b => b.classList.remove('lists-vis-btn--active'));
            btn.classList.add('lists-vis-btn--active');
            listsState.is_public = btn.dataset.value === '' ? null : btn.dataset.value === 'true';
            fetchLists();
        });
    });

    if (!IS_OWNER) {
    document.querySelector('.lists-vis-btn[data-value="false"]')?.remove();
    }

    // Search
    const searchInput = document.getElementById('listsSearch');
    const searchClear = document.getElementById('listsSearchClear');
    let searchTimer;
    searchInput.addEventListener('input', () => {
        listsState.search = searchInput.value.trim();
        searchClear.style.display = listsState.search ? '' : 'none';
        clearTimeout(searchTimer);
        searchTimer = setTimeout(fetchLists, 300);
    });
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        listsState.search = '';
        searchClear.style.display = 'none';
        fetchLists();
    });
}

// Redirects to the collection page while preserving the current tab (filters reset)
function restoreCollectionFilters() {
    const base = IS_OWNER
        ? '/collection'
        : `/users/${PROFILE_USERNAME}/collection`;
    window.location.href = `${base}?tab=${state.tab}`;
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

// Switches active collection tab, updates visible layouts, and loads matching content
function switchTab(tab) {
    if (!IS_OWNER && !PRIVACY[tab]) {
        showPrivateTab(tab);
        return;
    }

    const prevCountEl = document.getElementById(`count-${state.tab}`);
    if (prevCountEl) prevCountEl.textContent = '—';

    state.tab = tab;

    document.getElementById('collectionTitle').textContent = TAB_TITLES[tab] || tab;

    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        const href = item.getAttribute('href');
        item.classList.toggle('collection-nav__item--active', href.includes(`tab=${tab}`));
    });

    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);

    const isLists = tab === 'lists' || tab === 'liked_lists';
    document.getElementById('collectionGrid').style.display = isLists ? 'none' : '';
    document.getElementById('collectionEmpty').style.display = 'none';
    document.getElementById('listsGrid').style.display = isLists ? 'grid' : 'none';
    document.getElementById('listsEmpty').style.display = 'none';

    if (tab === 'liked_lists') {
        renderLikedListsFilters();
        fetchLikedLists();
    } else if (tab === 'lists') {
        renderListsFilters();
        fetchLists();
    } else {
        restoreCollectionFilters();
        updateRatingSection(tab);
    }
}

// Shows a "private" message when a non-owner visits a private tab
function showPrivateTab(tab) {
    state.tab = tab;

    document.getElementById('collectionTitle').textContent = TAB_TITLES[tab] || tab;

    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        const href = item.getAttribute('href');
        item.classList.toggle('collection-nav__item--active', href.includes(`tab=${tab}`));
    });

    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);

    document.getElementById('collectionGrid').style.display = 'none';
    document.getElementById('listsGrid').style.display = 'none';
    document.getElementById('collectionEmpty').style.display = 'none';
    document.getElementById('listsGrid').style.display = 'none';
    document.getElementById('listsEmpty').style.display = 'none';
    document.getElementById('collectionCount').textContent = '';

    let privateMsg = document.getElementById('collectionPrivateMsg');
    if (!privateMsg) {
        privateMsg = document.createElement('div');
        privateMsg.id = 'collectionPrivateMsg';
        privateMsg.className = 'collection-private-msg';
        document.querySelector('.collection-main').appendChild(privateMsg);
    }
    privateMsg.style.display = 'flex';
    privateMsg.innerHTML = `
        <span class="collection-private-msg__icon">🔒</span>
        <p class="collection-private-msg__text">This section is private</p>
    `;
}

// Loads available genres from API and injects them into dropdown
async function loadGenres() {
    try {
        const res = await fetch('/api/genres/');
        if (!res.ok) return;
        const genres = await res.json();
        const menu = document.getElementById('colGenreMenu');
        // Remove any genres already injected to avoid duplicates on re-init
        menu.querySelectorAll('.col-filter-option[data-filter="genre"]:not([data-value=""])').forEach(el => el.remove());
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

    if (!IS_OWNER && !PRIVACY[ACTIVE_TAB]) {
        showPrivateTab(ACTIVE_TAB);
        return;
    }

    if (ACTIVE_TAB === 'lists') {
        document.getElementById('collectionGrid').style.display = 'none';
        document.getElementById('listsGrid').style.display = 'grid';

        renderListsFilters();
        updateRatingSection(ACTIVE_TAB);

        document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
            const href = item.getAttribute('href');
            item.classList.toggle('collection-nav__item--active', href.includes('tab=lists'));
        });

        fetchLists();

    } else if (ACTIVE_TAB === 'liked_lists') {
        document.getElementById('collectionGrid').style.display = 'none';
        document.getElementById('listsGrid').style.display = 'grid';

        renderLikedListsFilters();
        updateRatingSection(ACTIVE_TAB);

        document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
            const href = item.getAttribute('href');
            item.classList.toggle('collection-nav__item--active', href.includes('tab=liked_lists'));
        });

        fetchLikedLists();

    } else {
        updateRatingSection(ACTIVE_TAB);

        document.getElementById('colResetFilters')
            .addEventListener('click', () => resetFilters(true));

        initDropdowns();
        initSortOptions();
        initYearOptions();
        initDurationOptions();
        initSearch();

        const defaultSortBtn = document.querySelector(
            `.col-filter-option[data-filter="sort"][data-value="${state.sort}"]`
        );
        if (defaultSortBtn) defaultSortBtn.classList.add('selected');

        await loadGenres();
        fetchCollection();
    }

    document.querySelectorAll('.collection-nav__item[href]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const url = new URL(item.getAttribute('href'), window.location.origin);
            const tab = url.searchParams.get('tab');
            if (tab) switchTab(tab);
        });
    });
}

init();