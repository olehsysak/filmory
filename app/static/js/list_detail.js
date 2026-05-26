'use strict';

// State
const state = {
    sort: 'added_desc',
    genre_id: null,
    genre_name: null,
    year_from: null,
    year_to: null,
    upcoming: false,
    runtime_min: null,
    runtime_max: null,
    search: '',
};

const durationLabels = {
    short:    'Short · under 90 min',
    standard: 'Standard · 90–150 min',
    long:     'Long · over 150 min',
};

// Edit modal state
let editIsPublic = null;
let editCoverFilmIds = [];

// Fetch films
async function fetchFilms() {
    const grid  = document.getElementById('ldGrid');
    const empty = document.getElementById('ldEmpty');

    renderSkeletons(grid);
    empty.style.display = 'none';

    const params = new URLSearchParams();

    if (state.sort === 'rated_only') {
        params.set('rated_only', 'true');
        params.set('sort', 'added_desc');
    } else if (state.sort === 'unrated_only') {
        params.set('unrated_only', 'true');
        params.set('sort', 'added_desc');
    } else {
        params.set('sort', state.sort);
    }

    if (state.genre_id)    params.set('genre_id', state.genre_id);
    if (state.year_from)   params.set('year_from', state.year_from);
    if (state.year_to)     params.set('year_to', state.year_to);
    if (state.upcoming)    params.set('upcoming', 'true');
    if (state.runtime_min) params.set('runtime_min', state.runtime_min);
    if (state.runtime_max) params.set('runtime_max', state.runtime_max);
    if (state.search)      params.set('search', state.search);

    try {
        const res   = await fetch(`/api/user/lists/${LIST_ID}/films?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const films = await res.json();

        // Update both count elements
        const coverCount = document.getElementById('ldFilmCount');
        const titleCount = document.getElementById('ldFilmsCount');
        if (coverCount) coverCount.textContent = films.length;
        if (titleCount) titleCount.textContent = `${films.length} film${films.length !== 1 ? 's' : ''}`;

        if (!films.length) {
            grid.innerHTML = '';
            empty.style.display = 'flex';
            return;
        }

        grid.innerHTML = films.map(renderFilmCard).join('');

        // Bind remove buttons (owner only)
        if (IS_OWNER) {
            grid.querySelectorAll('.ld-film-card__remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openRemoveFilmModal(btn.dataset.tmdb, btn.dataset.title);
                });
            });
        }

    } catch {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;grid-column:1/-1">Failed to load films.</p>';
    }
}

// Render film card
function renderFilmCard(film) {
    const year = film.release_date
        ? `<span class="ld-film-card__year">${film.release_date.substring(0, 4)}</span>`
        : '';

    const tmdbRating = film.vote_average
        ? `<span class="ld-film-card__rating">★ ${Number(film.vote_average).toFixed(1)}</span>`
        : '';

    const userRating = film.user_rating
        ? `<span class="ld-film-card__user-rating">★ ${film.user_rating}</span>`
        : '';

    const poster = film.poster_url
        ? `<img class="ld-film-card__poster" src="${film.poster_url}" alt="${escapeHtml(film.title)}" loading="lazy">`
        : `<div class="ld-film-card__poster" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">No poster</div>`;

    const removeBtn = IS_OWNER
        ? `<button class="ld-film-card__remove" data-tmdb="${film.tmdb_id}" data-title="${escapeHtml(film.title)}" title="Remove from list">×</button>`
        : '';

    return `
        <div class="ld-film-card-wrap">
            <a href="/film/${film.tmdb_id}" class="ld-film-card">
                ${poster}
                ${removeBtn}
                <div class="ld-film-card__info">
                    <p class="ld-film-card__title">${escapeHtml(film.title)}</p>
                    <div class="ld-film-card__meta">
                        ${tmdbRating}
                        ${userRating}
                        ${year}
                    </div>
                </div>
            </a>
        </div>
    `;
}

// Skeletons
function renderSkeletons(grid) {
    grid.innerHTML = Array(12).fill(`
        <div class="ld-skeleton-card">
            <div class="ld-skeleton-poster"></div>
            <div class="ld-skeleton-line" style="width:85%"></div>
            <div class="ld-skeleton-line" style="width:50%"></div>
        </div>
    `).join('');
}

// Dropdowns

// Close all open browse-bar menus
function closeAllMenus() {
    document.querySelectorAll('.ld-browse-bar__item.open')
        .forEach(item => item.classList.remove('open'));
}

// Dropdowns open on click (consistent with person/collection)
function initDropdowns() {
    document.querySelectorAll('.ld-browse-bar__item').forEach(item => {
        const btn = item.querySelector('.ld-browse-bar__btn');
        if (!btn) return;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = item.classList.contains('open');
            closeAllMenus();
            if (!isOpen) item.classList.add('open');
        });
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.ld-browse-bar__item')) closeAllMenus();
    });
}

// Filter options
function initFilterOptions() {
    // Sort
    document.querySelectorAll('.ld-filter-option[data-filter="sort"]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.sort = btn.dataset.value;
            document.getElementById('ldSortBtn').classList.toggle('active', state.sort !== 'added_desc');
            document.querySelectorAll('.ld-filter-option[data-filter="sort"]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    });

    // Genre — injected dynamically from GENRES constant
    const genreMenu = document.getElementById('ldGenreMenu');
    GENRES.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'ld-filter-option';
        btn.dataset.filter = 'genre';
        btn.dataset.value = g.id;
        btn.textContent = g.name;
        btn.addEventListener('click', () => {
            state.genre_id   = g.id;
            state.genre_name = g.name;
            document.getElementById('ldGenreBtn').classList.add('active');
            document.querySelectorAll('.ld-filter-option[data-filter="genre"]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
        genreMenu.appendChild(btn);
    });

    // Genre reset (All Genres)
    const genreReset = genreMenu.querySelector('.ld-filter-option[data-value=""]');
    if (genreReset) {
        genreReset.addEventListener('click', () => {
            state.genre_id   = null;
            state.genre_name = null;
            document.getElementById('ldGenreBtn').classList.remove('active');
            document.querySelectorAll('.ld-filter-option[data-filter="genre"]').forEach(b => b.classList.remove('selected'));
            genreReset.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    }

    // Upcoming option in year menu
    const upcomingBtn = document.querySelector('#ldYearMenu .ld-filter-option[data-filter="upcoming"]');
    if (upcomingBtn) {
        upcomingBtn.addEventListener('click', () => {
            state.upcoming  = true;
            state.year_from = null;
            state.year_to   = null;
            document.getElementById('ldYearBtn').classList.add('active');
            document.querySelectorAll('.ld-decade-btn').forEach(b => b.classList.remove('selected'));
            document.querySelectorAll('#ldYearMenu .ld-filter-option').forEach(b =>
                b.classList.toggle('selected', b === upcomingBtn)
            );
            removeYearSubmenu();
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    }

    // Year reset (All Years)
    const yearReset = document.querySelector('#ldYearMenu .ld-filter-option[data-value=""]');
    if (yearReset) {
        yearReset.addEventListener('click', () => {
            state.year_from = null;
            state.year_to   = null;
            state.upcoming  = false;
            document.getElementById('ldYearBtn').classList.remove('active');
            document.querySelectorAll('.ld-decade-btn').forEach(b => b.classList.remove('selected'));
            removeYearSubmenu();
            document.querySelectorAll('#ldYearMenu .ld-filter-option').forEach(b => b.classList.remove('selected'));
            yearReset.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    }

    // Duration
    document.querySelectorAll('.ld-filter-option[data-filter="duration"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const min = btn.dataset.min ? parseInt(btn.dataset.min) : null;
            const max = btn.dataset.max ? parseInt(btn.dataset.max) : null;
            const val = btn.dataset.value;

            state.runtime_min = min;
            state.runtime_max = max;

            document.getElementById('ldDurationBtn').classList.toggle('active', !!val);
            document.querySelectorAll('.ld-filter-option[data-filter="duration"]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    });
}

// Decade buttons + year submenu
function initDecadeButtons() {
    document.querySelectorAll('.ld-decade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const decade = parseInt(btn.dataset.decade);
            document.querySelectorAll('.ld-decade-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            showYearSubmenu(decade);
        });
    });
}

// Creates and displays a year submenu for a given decade
function showYearSubmenu(decade) {
    removeYearSubmenu();

    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = decade; y <= decade + 9 && y <= currentYear; y++) years.push(y);

    const submenu = document.createElement('div');
    submenu.className = 'year-submenu';
    submenu.id = 'ldYearSubmenu';
    submenu.innerHTML = `
        <div class="year-submenu__header">
            <span class="year-submenu__title">Pick a year or</span>
            <button class="year-submenu__decade-btn">${decade}s</button>
        </div>
        <div class="year-submenu__grid">
            ${years.map(y => `<button class="year-option" data-year="${y}">${y}</button>`).join('')}
        </div>
    `;

    document.getElementById('ldYearMenu').appendChild(submenu);

    // Apply whole decade as filter range
    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', e => {
        e.stopPropagation();
        state.year_from = decade;
        state.year_to   = Math.min(decade + 9, currentYear);
        document.getElementById('ldYearBtn').classList.add('active');
        closeAllMenus();
        renderActiveFilters();
        fetchFilms();
    });

    // Apply specific year
    submenu.querySelectorAll('.year-option').forEach(yBtn => {
        yBtn.addEventListener('click', e => {
            e.stopPropagation();
            const yr = parseInt(yBtn.dataset.year);
            state.year_from = yr;
            state.year_to   = yr;
            document.getElementById('ldYearBtn').classList.add('active');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    });
}

// Removes the active year submenu from the DOM
function removeYearSubmenu() {
    document.getElementById('ldYearSubmenu')?.remove();
}

// Active filter tags
function renderActiveFilters() {
    const container = document.getElementById('ldActiveFilters');
    const resetBtn  = document.getElementById('ldResetBtn');
    const bar       = document.getElementById('ldActiveFiltersBar');

    const tags = [];

    if (state.sort !== 'added_desc') {
        const sortLabels = {
            added_asc:        'Added · Oldest',
            release_desc:     'Release · Newest',
            release_asc:      'Release · Oldest',
            rating_desc:      'Rating · Highest',
            rating_asc:       'Rating · Lowest',
            user_rating_desc: 'Your rating · Highest',
            user_rating_asc:  'Your rating · Lowest',
            rated_only:       'Your rating · Rated only',
            unrated_only:     'Your rating · Not rated',
            popularity_desc:  'Popularity · High',
            runtime_desc:     'Runtime · Longest',
            runtime_asc:      'Runtime · Shortest',
        };
        tags.push({ key: 'sort', label: sortLabels[state.sort] || 'Sort' });
    }
    if (state.genre_id && state.genre_name) {
        tags.push({ key: 'genre', label: `Genre · ${state.genre_name}` });
    }
    if (state.upcoming) {
        tags.push({ key: 'upcoming', label: 'Year · Upcoming' });
    } else if (state.year_from || state.year_to) {
        const yearLabel = state.year_from === state.year_to
            ? `Year · ${state.year_from}`
            : `Year · ${state.year_from}s`;
        tags.push({ key: 'decade', label: yearLabel });
    }
    if (state.runtime_min || state.runtime_max) {
        const durKey = (!state.runtime_min && state.runtime_max <= 90) ? 'short'
            : (state.runtime_min >= 150) ? 'long' : 'standard';
        tags.push({ key: 'duration', label: durationLabels[durKey] });
    }
    if (state.search) {
        tags.push({ key: 'search', label: `"${state.search}"` });
    }

    container.innerHTML = tags.map(t => `
        <span class="ld-filter-tag">
            ${escapeHtml(t.label)}
            <button class="ld-filter-tag__remove" data-key="${t.key}">×</button>
        </span>
    `).join('');

    container.querySelectorAll('.ld-filter-tag__remove').forEach(btn => {
        btn.addEventListener('click', () => removeFilter(btn.dataset.key));
    });

    // Show/hide reset button
    if (resetBtn) resetBtn.style.display = tags.length ? '' : 'none';

    // Toggle empty state on bar
    if (bar) bar.classList.toggle('ld-active-filters-bar--empty', tags.length === 0);
}

// Remove individual filter
function removeFilter(key) {
    if (key === 'sort') {
        state.sort = 'added_desc';
        document.getElementById('ldSortBtn').classList.remove('active');
        document.querySelectorAll('.ld-filter-option[data-filter="sort"]').forEach(b =>
            b.classList.toggle('selected', b.dataset.value === 'added_desc')
        );
    }
    if (key === 'genre') {
        state.genre_id   = null;
        state.genre_name = null;
        document.getElementById('ldGenreBtn').classList.remove('active');
        document.querySelectorAll('.ld-filter-option[data-filter="genre"]').forEach(b =>
            b.classList.toggle('selected', b.dataset.value === '')
        );
    }
    if (key === 'decade' || key === 'upcoming') {
        state.year_from = null;
        state.year_to   = null;
        state.upcoming  = false;
        document.getElementById('ldYearBtn').classList.remove('active');
        document.querySelectorAll('.ld-decade-btn').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('#ldYearMenu .ld-filter-option').forEach(b =>
            b.classList.toggle('selected', b.dataset.value === '')
        );
        removeYearSubmenu();
    }
    if (key === 'duration') {
        state.runtime_min = null;
        state.runtime_max = null;
        document.getElementById('ldDurationBtn').classList.remove('active');
        document.querySelectorAll('.ld-filter-option[data-filter="duration"]').forEach(b =>
            b.classList.toggle('selected', b.dataset.value === '')
        );
    }
    if (key === 'search') {
        state.search = '';
        document.getElementById('ldSearch').value = '';
        document.getElementById('ldSearchClear').style.display = 'none';
    }

    renderActiveFilters();
    fetchFilms();
}

// Reset
function initReset() {
    const btn = document.getElementById('ldResetBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        // Reset state
        state.sort        = 'added_desc';
        state.genre_id    = null;
        state.genre_name  = null;
        state.year_from   = null;
        state.year_to     = null;
        state.upcoming    = false;
        state.runtime_min = null;
        state.runtime_max = null;
        state.search      = '';

        // Reset button active states
        document.getElementById('ldSortBtn').classList.remove('active');
        document.getElementById('ldGenreBtn').classList.remove('active');
        document.getElementById('ldYearBtn').classList.remove('active');
        document.getElementById('ldDurationBtn').classList.remove('active');

        // Reset search input
        document.getElementById('ldSearch').value = '';
        document.getElementById('ldSearchClear').style.display = 'none';

        // Reset selected options
        document.querySelectorAll('.ld-filter-option.selected, .ld-decade-btn.selected')
            .forEach(b => b.classList.remove('selected'));

        // Restore defaults
        const defSort = document.querySelector('.ld-filter-option[data-filter="sort"][data-value="added_desc"]');
        if (defSort) defSort.classList.add('selected');
        const defYear = document.querySelector('#ldYearMenu .ld-filter-option[data-value=""]');
        if (defYear) defYear.classList.add('selected');
        const defDur = document.querySelector('.ld-filter-option[data-filter="duration"][data-value=""]');
        if (defDur) defDur.classList.add('selected');

        removeYearSubmenu();
        renderActiveFilters();
        fetchFilms();
    });
}

// Search
function initSearch() {
    const input = document.getElementById('ldSearch');
    const clear = document.getElementById('ldSearchClear');
    let debounceTimer;

    input.addEventListener('input', () => {
        clear.style.display = input.value ? 'block' : 'none';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.search = input.value.trim();
            renderActiveFilters();
            fetchFilms();
        }, 350);
    });

    clear.addEventListener('click', () => {
        input.value = '';
        clear.style.display = 'none';
        state.search = '';
        renderActiveFilters();
        fetchFilms();
    });
}

// Edit modal
function initEditModal() {
    if (!IS_OWNER) return;

    const overlay   = document.getElementById('ldEditOverlay');
    const openBtn   = document.getElementById('ldEditBtn');
    const closeBtn  = document.getElementById('ldEditClose');
    const cancelBtn = document.getElementById('ldEditCancel');
    const saveBtn   = document.getElementById('ldEditSave');

    openBtn.addEventListener('click', openEditModal);
    closeBtn.addEventListener('click', closeEditModal);
    cancelBtn.addEventListener('click', closeEditModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditModal(); });

    // Visibility toggle
    document.querySelectorAll('.ld-vis-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            editIsPublic = btn.dataset.value === 'true';
            document.querySelectorAll('.ld-vis-btn').forEach(b => b.classList.remove('ld-vis-btn--active'));
            btn.classList.add('ld-vis-btn--active');
        });
    });

    saveBtn.addEventListener('click', saveEdit);
}

// Opens the edit modal and initializes its state
function openEditModal() {
    const overlay = document.getElementById('ldEditOverlay');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const activeVisBtn = document.querySelector('.ld-vis-btn--active');
    editIsPublic = activeVisBtn ? activeVisBtn.dataset.value === 'true' : false;

    editCoverFilmIds = [...CURRENT_COVER_FILM_IDS];
    loadCoverPicker();

    // Init char counter for name
    const nameInput   = document.getElementById('ldEditName');
    const nameCounter = document.getElementById('ldNameCounter');
    if (nameInput && nameCounter) {
        const updateName = () => { nameCounter.textContent = `${nameInput.value.length} / 50`; };
        updateName();
        nameInput.addEventListener('input', updateName);
    }

    // Init char counter for description
    const textarea = document.getElementById('ldEditDesc');
    const counter  = document.getElementById('ldDescCounter');
    if (textarea && counter) {
        const update = () => { counter.textContent = `${textarea.value.length} / 475`; };
        update();
        textarea.addEventListener('input', update);
    }
}

// Closes the edit modal and restores page scrolling
function closeEditModal() {
    document.getElementById('ldEditOverlay').style.display = 'none';
    document.body.style.overflow = '';
}

// Saves updated list data and sends changes to the server
async function saveEdit() {
    const name = document.getElementById('ldEditName').value.trim();
    const desc = document.getElementById('ldEditDesc').value.trim();

    if (!name) return;

    const saveBtn = document.getElementById('ldEditSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const body = {
            name,
            description: desc || null,
            is_public: editIsPublic,
        };

        if (editCoverFilmIds.length) body.cover_film_ids = editCoverFilmIds;

        const res = await fetch(`/api/user/lists/${LIST_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error();

        closeEditModal();
        window.location.reload();

    } catch {
        alert('Failed to save changes. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
    }
}

// Loads cover picker with film posters from the list
async function loadCoverPicker() {
    const picker = document.getElementById('ldCoverPicker');
    picker.innerHTML = '<p class="ld-cover-picker__empty">Loading...</p>';

    try {
        const res   = await fetch(`/api/user/lists/${LIST_ID}/films?sort=added_desc`);
        const films = await res.json();

        if (!films.length) {
            picker.innerHTML = '<p class="ld-cover-picker__empty">Add films to pick a cover</p>';
            return;
        }

        picker.innerHTML = films
            .filter(f => f.poster_url)
            .map((f, i) => {
                const isSelected = editCoverFilmIds.includes(f.id);
                const order      = editCoverFilmIds.indexOf(f.id) + 1;
                return `
                    <div class="ld-cover-item ${isSelected ? 'ld-cover-item--selected' : ''}"
                         data-film-id="${f.id}" data-poster="${f.poster_url}">
                        <img src="${f.poster_url}" alt="${escapeHtml(f.title)}">
                        <div class="ld-cover-item__check">
                            <span class="ld-cover-item__num">${isSelected ? order : ''}</span>
                        </div>
                        <p class="ld-cover-item__title">${escapeHtml(f.title)}</p>
                    </div>
                `;
            }).join('');

        picker.querySelectorAll('.ld-cover-item').forEach(item => {
            item.addEventListener('click', () => toggleCoverItem(item, films));
        });

    } catch {
        picker.innerHTML = '<p class="ld-cover-picker__empty">Failed to load films</p>';
    }
}

// Toggles film selection state in the cover picker and updates selection order
function toggleCoverItem(item, films) {
    const filmId = parseInt(item.dataset.filmId);
    const idx    = editCoverFilmIds.indexOf(filmId);

    if (idx !== -1) {
        editCoverFilmIds.splice(idx, 1);
        item.classList.remove('ld-cover-item--selected');
    } else if (editCoverFilmIds.length < 5) {
        editCoverFilmIds.push(filmId);
        item.classList.add('ld-cover-item--selected');
    }

    // Re-render numbers
    const picker = document.getElementById('ldCoverPicker');
    picker.querySelectorAll('.ld-cover-item').forEach(el => {
        const id  = parseInt(el.dataset.filmId);
        const pos = editCoverFilmIds.indexOf(id);
        const num = el.querySelector('.ld-cover-item__num');
        el.classList.toggle('ld-cover-item--selected', pos !== -1);
        if (num) num.textContent = pos !== -1 ? pos + 1 : '';
    });
}

// Delete modal
function initDeleteModal() {
    if (!IS_OWNER) return;

    const overlay   = document.getElementById('ldDeleteOverlay');
    const openBtn   = document.getElementById('ldDeleteBtn');
    const closeBtn  = document.getElementById('ldDeleteClose');
    const cancelBtn = document.getElementById('ldDeleteCancel');
    const confirmBtn = document.getElementById('ldDeleteConfirm');

    const open  = () => { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; };
    const close = () => { overlay.style.display = 'none'; document.body.style.overflow = ''; };

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';
        try {
            const res = await fetch(`/api/user/lists/${LIST_ID}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            window.location.href = '/collection?tab=lists';
        } catch {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
            alert('Failed to delete list. Please try again.');
        }
    });
}

// Add film modal
function initAddFilmModal() {
    if (!IS_OWNER) return;

    const overlay   = document.getElementById('ldAddFilmOverlay');
    const openBtn   = document.getElementById('ldAddFilmBtn');
    const closeBtn  = document.getElementById('ldAddFilmClose');
    const searchInput = document.getElementById('ldAddFilmSearch');
    const clearBtn  = document.getElementById('ldAddFilmClear');
    const results   = document.getElementById('ldAddResults');

    const open  = () => { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; searchInput.focus(); };
    const close = () => { overlay.style.display = 'none'; document.body.style.overflow = ''; searchInput.value = ''; results.innerHTML = '<p class="ld-add-results__hint">Start typing to search films</p>'; clearBtn.style.display = 'none'; };

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    let debounce;
    searchInput.addEventListener('input', () => {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
        clearTimeout(debounce);
        if (!searchInput.value.trim()) {
            results.innerHTML = '<p class="ld-add-results__hint">Start typing to search films</p>';
            return;
        }
        debounce = setTimeout(() => searchFilms(searchInput.value.trim(), results), 350);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        results.innerHTML = '<p class="ld-add-results__hint">Start typing to search films</p>';
    });
}

// Searches films, renders results, and handles adding films to the list
async function searchFilms(q, results) {
    results.innerHTML = '<p class="ld-add-results__hint">Searching...</p>';
    try {
        const [searchRes, listRes] = await Promise.all([
            fetch(`/api/search?q=${encodeURIComponent(q)}&type=film&limit=20`),
            fetch(`/api/user/lists/${LIST_ID}/films`),
        ]);

        const data      = await searchRes.json();
        const listFilms = await listRes.json();

        const films        = data.films || [];
        const addedTmdbIds = new Set(listFilms.map(f => f.tmdb_id));

        if (!films.length) {
            results.innerHTML = '<p class="ld-add-results__hint">No results found</p>';
            return;
        }

        results.innerHTML = films.map(f => {
            const year    = f.release_date ? new Date(f.release_date).getFullYear() : '';
            const isAdded = addedTmdbIds.has(f.tmdb_id);
            return `
                <button class="ld-add-result-item ${isAdded ? 'ld-add-result-item--added' : ''}" data-tmdb="${f.tmdb_id}" ${isAdded ? 'disabled' : ''}>
                    ${f.poster_url
                        ? `<img class="ld-add-result-item__poster" src="${f.poster_url}" alt="">`
                        : `<div class="ld-add-result-item__no-poster"></div>`
                    }
                    <div class="ld-add-result-item__info">
                        <p class="ld-add-result-item__title">${escapeHtml(f.title)}</p>
                        <p class="ld-add-result-item__meta">${[year, f.vote_average ? '★ ' + Number(f.vote_average).toFixed(1) : ''].filter(Boolean).join(' · ')}</p>
                        ${isAdded ? '<p class="ld-add-result-item__status">Already in list</p>' : ''}
                    </div>
                    ${!isAdded ? '<span class="ld-add-result-item__plus">+</span>' : ''}
                </button>
            `;
        }).join('');

        results.querySelectorAll('.ld-add-result-item:not([disabled])').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;
                btn.disabled = true;
                const plusIcon = btn.querySelector('.ld-add-result-item__plus');
                if (plusIcon) plusIcon.style.opacity = '0.4';
                try {
                    const tmdbId = parseInt(btn.dataset.tmdb);
                    const res = await fetch(`/api/user/lists/${LIST_ID}/films/${tmdbId}`, {
                        method: 'POST',
                    });
                    if (!res.ok) throw new Error();
                    btn.classList.add('ld-add-result-item--added');
                    if (plusIcon) plusIcon.remove();
                    btn.querySelector('.ld-add-result-item__info').insertAdjacentHTML(
                        'beforeend', '<p class="ld-add-result-item__status">Added ✓</p>'
                    );
                    fetchFilms();
                } catch {
                    btn.disabled = false;
                    if (plusIcon) plusIcon.style.opacity = '';
                    alert('Failed to add film. Please try again.');
                }
            });
        });

    } catch {
        results.innerHTML = '<p class="ld-add-results__hint">Failed to search. Try again.</p>';
    }
}

// Remove film modal
function initRemoveFilmModal() {
    if (!IS_OWNER) return;

    const overlay    = document.getElementById('ldRemoveFilmOverlay');
    const closeBtn   = document.getElementById('ldRemoveFilmClose');
    const cancelBtn  = document.getElementById('ldRemoveFilmCancel');
    const confirmBtn = document.getElementById('ldRemoveFilmConfirm');

    let pendingTmdbId = null;

    // Expose global handler used by film card
    window.openRemoveFilmModal = (tmdbId, title) => {
        pendingTmdbId = tmdbId;
        document.getElementById('ldRemoveFilmTitle').textContent = title;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    const close = () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        pendingTmdbId = null;
    };

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    confirmBtn.addEventListener('click', async () => {
        if (!pendingTmdbId) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Removing...';
        try {
            await fetch(`/api/user/lists/${LIST_ID}/films/${pendingTmdbId}`, { method: 'DELETE' });
            close();
            fetchFilms();
        } catch {
            alert('Failed to remove film.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Remove';
        }
    });
}

// Like
function initLike() {
    const btn = document.getElementById('ldLikeBtn');
    if (!btn) return;

    let liked      = IS_LIKED;
    let processing = false;

    btn.addEventListener('click', async () => {
        if (processing) return;
        processing = true;
        btn.style.opacity = '0.6';

        try {
            const res = await fetch(`/api/user/lists/${LIST_ID}/like`, { method: 'POST' });
            if (!res.ok) throw new Error();

            const data = await res.json();
            liked = data.liked;

            // Update like count in button and in cover stats
            document.getElementById('ldLikeCount').textContent = data.likes_count;
            const statCount = document.getElementById('ldLikesCountStat');
            if (statCount) statCount.textContent = data.likes_count;

            // Toggle active state and SVG fill
            const svg = btn.querySelector('path');
            if (liked) {
                btn.classList.add('ld-btn--like--active');
                if (svg) svg.setAttribute('fill', 'currentColor');
            } else {
                btn.classList.remove('ld-btn--like--active');
                if (svg) svg.setAttribute('fill', 'none');
            }

        } catch {
            // silent fail
        } finally {
            processing = false;
            btn.style.opacity = '';
        }
    });
}

// Fork
function initFork() {
    const forkBtn = document.getElementById('ldForkBtn');
    if (!forkBtn) return;

    const overlay    = document.getElementById('ldForkOverlay');
    const closeBtn   = document.getElementById('ldForkClose');
    const cancelBtn  = document.getElementById('ldForkCancel');
    const confirmBtn = document.getElementById('ldForkConfirm');

    const open  = () => { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; };
    const close = () => { overlay.style.display = 'none'; document.body.style.overflow = ''; };

    forkBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Copying...';
        try {
            const res  = await fetch(`/api/user/lists/${LIST_ID}/fork`, { method: 'POST' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            close();
            window.location.href = `/list/${data.id}`;
        } catch {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Copy list';
            alert('Failed to copy list. Please try again.');
        }
    });
}

// Copy link
function initCopyLink() {
    // Works for both owner (ldCopyLinkBtn) and non-owner (ldCopyLinkBtn2)
    ['ldCopyLinkBtn', 'ldCopyLinkBtn2'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        const labelId = btnId === 'ldCopyLinkBtn' ? 'ldCopyLinkLabel' : 'ldCopyLinkLabel2';
        const label   = document.getElementById(labelId);

        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                if (label) label.textContent = 'Copied!';
                btn.classList.add('ld-btn--copy--success');
                setTimeout(() => {
                    if (label) label.textContent = 'Copy link';
                    btn.classList.remove('ld-btn--copy--success');
                }, 2000);
            } catch {
                const input = document.createElement('input');
                input.value = window.location.href;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                if (label) label.textContent = 'Copied!';
                setTimeout(() => { if (label) label.textContent = 'Copy link'; }, 2000);
            }
        });
    });
}

// Guest view tracking
function initGuestView() {
    if (IS_LOGGED_IN) return;

    const key = `viewed_list_${LIST_ID}`;
    if (sessionStorage.getItem(key)) return;

    sessionStorage.setItem(key, '1');
    fetch(`/api/user/lists/${LIST_ID}/view`, { method: 'POST' }).catch(() => {});
}

// Escapes special HTML characters to prevent HTML injection
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Init
function init() {
    initDropdowns();
    initFilterOptions();
    initDecadeButtons();
    initSearch();
    initReset();
    initEditModal();
    initDeleteModal();
    initAddFilmModal();
    initRemoveFilmModal();
    initLike();
    initFork();
    initCopyLink();
    initGuestView();
    fetchFilms();
}

init();