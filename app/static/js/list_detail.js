'use strict';

// State
const state = {
    sort: 'added_desc',
    genre_id: null,
    year_from: null,
    year_to: null,
    runtime_min: null,
    runtime_max: null,
    search: '',
};

const durationLabels = {
    short: 'Short · under 90 min',
    standard: 'Standard · 90–150 min',
    long: 'Long · over 150 min',
};

// Edit modal state
let editIsPublic = null;    // set on modal open
let editCoverFilmIds = []; // internal film id selected in cover picker

// Fetch films from API based on current filter state
async function fetchFilms() {
    const grid = document.getElementById('ldGrid');
    const empty = document.getElementById('ldEmpty');

    renderSkeletons(grid);
    empty.style.display = 'none';

    const params = new URLSearchParams();

    // Handle special sort modes (rated/unrated)
    if (state.sort === 'rated_only') {
        params.set('rated_only', 'true');
        params.set('sort', 'added_desc');
    } else if (state.sort === 'unrated_only') {
        params.set('unrated_only', 'true');
        params.set('sort', 'added_desc');
    } else {
        params.set('sort', state.sort);
    }

    // Apply filters only if they exist
    if (state.genre_id)    params.set('genre_id', state.genre_id);
    if (state.year_from)   params.set('year_from', state.year_from);
    if (state.year_to)     params.set('year_to', state.year_to);
    if (state.runtime_min) params.set('runtime_min', state.runtime_min);
    if (state.runtime_max) params.set('runtime_max', state.runtime_max);
    if (state.search)      params.set('search', state.search);

    try {
        const res = await fetch(`/api/user/lists/${LIST_ID}/films?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const films = await res.json();

        // Update film count badge
        const countEl = document.getElementById('ldFilmCount');
        if (countEl) countEl.textContent = films.length;

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

// Render a single film card inside list grid.
function renderFilmCard(film) {
    const year = film.release_date
        ? `<span class="ld-film-card__year">${film.release_date.substring(0, 4)}</span>`
        : '';

    const tmdbRating = film.vote_average
        ? `<span class="ld-film-card__rating">★ ${film.vote_average.toFixed(1)}</span>`
        : '';

    const userRating = film.user_rating
        ? `<span class="ld-film-card__user-rating">★ ${film.user_rating}</span>`
        : '';

    // Poster fallback for missing images
    const poster = film.poster_url
        ? `<img class="ld-film-card__poster" src="${film.poster_url}" alt="${escapeHtml(film.title)}" loading="lazy">`
        : `<div class="ld-film-card__poster" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">No poster</div>`;

    // Owner-only remove button
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

// Render loading skeleton cards while films are being fetched
function renderSkeletons(grid) {
    grid.innerHTML = Array(12).fill(`
        <div class="ld-skeleton-card">
            <div class="ld-skeleton-poster"></div>
            <div class="ld-skeleton-line" style="width:85%"></div>
            <div class="ld-skeleton-line" style="width:50%"></div>
        </div>
    `).join('');
}

// Render active filter tags based on current state
function renderActiveFilters() {
    const container = document.getElementById('ldActiveFilters');
    const tags = [];

    if (state.sort !== 'added_desc') {
        tags.push({ key: 'sort', label: document.getElementById('ldSortLabel').textContent });
    }
    if (state.genre_id) {
        tags.push({ key: 'genre', label: document.getElementById('ldGenreLabel').textContent });
    }
    if (state.year_from || state.year_to) {
        tags.push({ key: 'decade', label: document.getElementById('ldYearLabel').textContent });
    }
    if (state.runtime_min || state.runtime_max) {
        tags.push({ key: 'duration', label: document.getElementById('ldDurationLabel').textContent });
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
    const resetBtn = document.getElementById('ldResetBtn');
    if (resetBtn) resetBtn.style.display = tags.length ? 'block' : 'none';
}

// Remove a specific filter from state and UI
function removeFilter(key) {
    if (key === 'sort') {
        state.sort = 'added_desc';
        document.getElementById('ldSortLabel').textContent = 'Sort';
        document.getElementById('ldSortBtn').classList.remove('active');
    }
    if (key === 'genre') {
        state.genre_id = null;
        document.getElementById('ldGenreLabel').textContent = 'Genre';
        document.getElementById('ldGenreBtn').classList.remove('active');
    }
    if (key === 'decade') {
        state.year_from = null;
        state.year_to = null;
        document.getElementById('ldYearLabel').textContent = 'Year';
        document.getElementById('ldYearBtn').classList.remove('active');
        removeYearSubmenu();
    }
    if (key === 'duration') {
        state.runtime_min = null;
        state.runtime_max = null;
        document.getElementById('ldDurationLabel').textContent = 'Duration';
        document.getElementById('ldDurationBtn').classList.remove('active');
    }
    if (key === 'search') {
        state.search = '';
        document.getElementById('ldSearch').value = '';
        document.getElementById('ldSearchClear').style.display = 'none';
    }

    document.querySelectorAll('.ld-filter-option.selected').forEach(b => b.classList.remove('selected'));
    renderActiveFilters();
    fetchFilms();
}

// Initialize dropdown open/close behavior
function initDropdowns() {
    // Close all menus on outside click
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-dropdown').forEach(dd => {
            if (!dd.contains(e.target)) {
                dd.querySelectorAll('.filter-dropdown__menu').forEach(m => m.classList.remove('open'));
            }
        });
    });

    // Toggle each dropdown
    ['ldSortDropdown', 'ldGenreDropdown', 'ldYearDropdown', 'ldDurationDropdown'].forEach(id => {
        const dd = document.getElementById(id);
        if (!dd) return;
        const btn = dd.querySelector('.filter-btn');
        const menu = dd.querySelector('.filter-dropdown__menu');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            document.querySelectorAll('.filter-dropdown__menu').forEach(m => m.classList.remove('open'));
            if (!isOpen) menu.classList.add('open');
        });
    });
}

// Initialize filter option click handlers
function initFilterOptions() {
    // Sort
    document.querySelectorAll('.ld-filter-option[data-filter="sort"]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.sort = btn.dataset.value;
            document.getElementById('ldSortLabel').textContent = btn.dataset.label || btn.textContent.trim();
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
            state.genre_id = g.id;
            document.getElementById('ldGenreLabel').textContent = g.name;
            document.getElementById('ldGenreBtn').classList.add('active');
            document.querySelectorAll('.ld-filter-option[data-filter="genre"]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
        genreMenu.appendChild(btn);
    });

    // Genre "All Genres" button
    const allGenreBtn = genreMenu.querySelector('.ld-filter-option[data-value=""]');
    if (allGenreBtn) {
        allGenreBtn.addEventListener('click', () => {
            state.genre_id = null;
            document.getElementById('ldGenreLabel').textContent = 'Genre';
            document.getElementById('ldGenreBtn').classList.remove('active');
            document.querySelectorAll('.ld-filter-option[data-filter="genre"]').forEach(b => b.classList.remove('selected'));
            allGenreBtn.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    }

    // Year "All Years" button
    const allYearBtn = document.querySelector('.ld-filter-option[data-filter="year"][data-value=""]');
    if (allYearBtn) {
        allYearBtn.addEventListener('click', () => {
            state.year_from = null;
            state.year_to = null;
            document.getElementById('ldYearLabel').textContent = 'Year';
            document.getElementById('ldYearBtn').classList.remove('active');
            removeYearSubmenu();
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

            document.getElementById('ldDurationLabel').textContent = val ? durationLabels[val] : 'Duration';
            document.getElementById('ldDurationBtn').classList.toggle('active', !!val);
            document.querySelectorAll('.ld-filter-option[data-filter="duration"]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    });
}

// Initializes decade buttons in the year filter dropdown
function initDecadeButtons() {
    document.querySelectorAll('.ld-decade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const decade = parseInt(btn.dataset.decade);
            document.querySelectorAll('.ld-decade-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            // Only show submenu — filter applied on decade btn click inside submenu
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

    // Decade badge — apply whole decade as filter
    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', e => {
        e.stopPropagation();
        state.year_from = decade;
        state.year_to = Math.min(decade + 9, currentYear);
        document.getElementById('ldYearLabel').textContent = `${decade}s`;
        document.getElementById('ldYearBtn').classList.add('active');
        closeAllMenus();
        renderActiveFilters();
        fetchFilms();
    });

    // Specific year buttons
    submenu.querySelectorAll('.year-option').forEach(yb => {
        yb.addEventListener('click', e => {
            e.stopPropagation();
            const yr = parseInt(yb.dataset.year);
            state.year_from = yr;
            state.year_to = yr;
            document.getElementById('ldYearLabel').textContent = String(yr);
            document.getElementById('ldYearBtn').classList.add('active');
            closeAllMenus();
            renderActiveFilters();
            fetchFilms();
        });
    });
}

// Removes the currently opened year submenu if it exists
function removeYearSubmenu() {
    document.getElementById('ldYearSubmenu')?.remove();
}

// Closes all open filter dropdown menus
function closeAllMenus() {
    document.querySelectorAll('.filter-dropdown__menu').forEach(m => m.classList.remove('open'));
}

// Initializes search input behavior with debounce
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

// Resets all active filters to their default state
function initReset() {
    const btn = document.getElementById('ldResetBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        // Reset internal filter state
        state.sort = 'added_desc';
        state.genre_id = null;
        state.year_from = null;
        state.year_to = null;
        state.runtime_min = null;
        state.runtime_max = null;
        state.search = '';

        // Reset UI labels and active states
        document.getElementById('ldSortLabel').textContent = 'Sort';
        document.getElementById('ldSortBtn').classList.remove('active');

        document.getElementById('ldGenreLabel').textContent = 'Genre';
        document.getElementById('ldGenreBtn').classList.remove('active');

        document.getElementById('ldYearLabel').textContent = 'Year';
        document.getElementById('ldYearBtn').classList.remove('active');

        document.getElementById('ldDurationLabel').textContent = 'Duration';
        document.getElementById('ldDurationBtn').classList.remove('active');

        document.getElementById('ldSearch').value = '';
        document.getElementById('ldSearchClear').style.display = 'none';

        // Clear selected filter UI states
        document.querySelectorAll('.ld-filter-option.selected, .ld-decade-btn.selected').forEach(b => b.classList.remove('selected'));

        removeYearSubmenu();
        renderActiveFilters();
        fetchFilms();
    });
}

// Initializes edit modal behavior for list owner
function initEditModal() {
    if (!IS_OWNER) return;

    const overlay = document.getElementById('ldEditOverlay');
    const openBtn = document.getElementById('ldEditBtn');
    const closeBtn = document.getElementById('ldEditClose');
    const cancelBtn = document.getElementById('ldEditCancel');
    const saveBtn = document.getElementById('ldEditSave');

    openBtn.addEventListener('click', openEditModal);
    closeBtn.addEventListener('click', closeEditModal);
    cancelBtn.addEventListener('click', closeEditModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeEditModal();
    });

    // VToggle list visibility (public/private)
    document.querySelectorAll('.ld-vis-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            editIsPublic = btn.dataset.value === 'true';
            document.querySelectorAll('.ld-vis-btn').forEach(b => b.classList.remove('ld-vis-btn--active'));
            btn.classList.add('ld-vis-btn--active');
        });
    });

    saveBtn.addEventListener('click', saveEdit);
}

// Opens edit modal and syncs current state
function openEditModal() {
    const overlay = document.getElementById('ldEditOverlay');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Sync visibility state from active button
    const activeVisBtn = document.querySelector('.ld-vis-btn--active');
    editIsPublic = activeVisBtn ? activeVisBtn.dataset.value === 'true' : false;

    loadCoverPicker();
}

// Closes edit modal and restores page scroll
function closeEditModal() {
    document.getElementById('ldEditOverlay').style.display = 'none';
    document.body.style.overflow = '';
}

// Loads films and initializes cover picker grid
async function loadCoverPicker() {
    const picker = document.getElementById('ldCoverPicker');
    picker.innerHTML = '<div class="ld-cover-picker__empty">Loading...</div>';

    try {
        const res = await fetch(`/api/user/lists/${LIST_ID}/films?sort=added_desc`);
        if (!res.ok) throw new Error();
        const films = await res.json();

        if (!films.length) {
            picker.innerHTML = '<div class="ld-cover-picker__empty">No films in this list yet.</div>';
            return;
        }

        editCoverFilmIds = CURRENT_COVER_FILM_IDS ? [...CURRENT_COVER_FILM_IDS] : [];
        renderCoverPicker(picker, films);

    } catch {
        picker.innerHTML = '<div class="ld-cover-picker__empty">Failed to load films.</div>';
    }
}

// Renders selectable film posters for list cover selection
function renderCoverPicker(picker, films) {
    picker.innerHTML = films.map(f => {
        const pos = editCoverFilmIds.indexOf(f.id);
        const isSelected = pos !== -1;

        return `
            <div class="ld-cover-item ${isSelected ? 'ld-cover-item--selected' : ''}"
                 data-film-id="${f.id}"
                 data-poster="${f.poster_url || ''}"
                 title="${escapeHtml(f.title)}">
                ${f.poster_url
                    ? `<img src="${f.poster_url}" alt="${escapeHtml(f.title)}" loading="lazy">`
                    : `<div class="ld-cover-item__placeholder">No img</div>`
                }
                <div class="ld-cover-item__check" style="display:${isSelected ? 'flex' : 'none'}">
                    <span class="ld-cover-item__num">${isSelected ? pos + 1 : ''}</span>
                </div>
            </div>
        `;
    }).join('');

    picker.querySelectorAll('.ld-cover-item').forEach(item => {
        item.addEventListener('click', () => {
            const filmId = parseInt(item.dataset.filmId);
            const pos = editCoverFilmIds.indexOf(filmId);

            if (pos !== -1) {
                editCoverFilmIds.splice(pos, 1);
            } else {
                if (editCoverFilmIds.length >= 3) return;
                editCoverFilmIds.push(filmId);
            }

            const allFilms = [...picker.querySelectorAll('.ld-cover-item')].map(el => ({
                id: parseInt(el.dataset.filmId),
                title: el.title,
                poster_url: el.dataset.poster || null,
            }));
            renderCoverPicker(picker, allFilms);
        });
    });
}

// Sends updated list metadata to backend and reloads page on success
async function saveEdit() {
    const saveBtn = document.getElementById('ldEditSave');
    const name = document.getElementById('ldEditName').value.trim();
    const description = document.getElementById('ldEditDesc').value.trim();

    if (!name) {
        document.getElementById('ldEditName').focus();
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const body = {
        name,
        description: description || null,
        is_public: editIsPublic,
        cover_film_ids: editCoverFilmIds,
    };

    try {
        const res = await fetch(`/api/user/lists/${LIST_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error();
        window.location.reload();

    } catch {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
        alert('Failed to save changes. Please try again.');
    }
}

// Handles confirmation modal for deleting a list
function initDeleteModal() {
    if (!IS_OWNER) return;

    const overlay = document.getElementById('ldDeleteOverlay');
    const openBtn = document.getElementById('ldDeleteBtn');
    const closeBtn = document.getElementById('ldDeleteClose');
    const cancelBtn = document.getElementById('ldDeleteCancel');
    const confirmBtn = document.getElementById('ldDeleteConfirm');

    // Open modal
    openBtn.addEventListener('click', () => {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });

    // Close modal helper
    const close = () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    };

    // Close handlers
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Confirm delete request
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        try {
            const res = await fetch(`/api/user/lists/${LIST_ID}`, { method: 'DELETE' });

            if (!res.ok && res.status !== 204) throw new Error();
            window.location.href = '/collection?tab=lists';

        } catch {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
            alert('Failed to delete list. Please try again.');
        }
    });
}

// Allows searching and adding films to the current list
function initAddFilmModal() {
    if (!IS_OWNER) return;

    const openBtn = document.getElementById('ldAddFilmBtn');
    const overlay = document.getElementById('ldAddFilmOverlay');
    const closeBtn = document.getElementById('ldAddFilmClose');
    const searchInput = document.getElementById('ldAddFilmSearch');
    const clearBtn = document.getElementById('ldAddFilmClear');
    const results = document.getElementById('ldAddResults');

    if (!openBtn) return;

    // Open modal
    openBtn.addEventListener('click', () => {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => searchInput.focus(), 50);
    });

    // Close modal + reset state
    const close = () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        searchInput.value = '';
        clearBtn.style.display = 'none';
        results.innerHTML = '<p class="ld-add-results__hint">Start typing to search films</p>';
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Clear search input
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        results.innerHTML = '<p class="ld-add-results__hint">Start typing to search films</p>';
        searchInput.focus();
    });

    // Debounced search input
    let debounce;

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        clearBtn.style.display = q ? 'block' : 'none';
        clearTimeout(debounce);

        if (q.length < 2) {
            results.innerHTML = '<p class="ld-add-results__hint">Start typing to search films</p>';
            return;
        }
        debounce = setTimeout(() => searchFilms(q), 300);
    });

    // Search API + render results
    async function searchFilms(q) {
        results.innerHTML = '<p class="ld-add-results__hint">Searching...</p>';

        try {
            const [searchRes, listRes] = await Promise.all([
                fetch(`/api/search?q=${encodeURIComponent(q)}&type=film&limit=20`),
                fetch(`/api/user/lists/${LIST_ID}/films`),
            ]);

            const data = await searchRes.json();
            const listFilms = await listRes.json();

            const films = data.films || [];
            const addedTmdbIds = new Set(listFilms.map(f => f.tmdb_id));

            if (!films.length) {
                results.innerHTML = '<p class="ld-add-results__hint">No films found</p>';
                return;
            }

            // Render search results
            results.innerHTML = films.map(f => {
                const year = f.release_date ? new Date(f.release_date).getFullYear() : '';
                const rating = f.vote_average ? `★ ${Number(f.vote_average).toFixed(1)}` : '';
                const meta = [year, rating].filter(Boolean).join(' · ');
                const isAdded = addedTmdbIds.has(f.tmdb_id);

                return `
                    <button class="ld-add-result-item ${isAdded ? 'ld-add-result-item--added' : ''}" data-tmdb="${f.tmdb_id}">
                        ${f.poster_url
                            ? `<img class="ld-add-result-item__poster" src="${f.poster_url}" alt="" loading="lazy">`
                            : `<div class="ld-add-result-item__no-poster"></div>`
                        }
                        <div class="ld-add-result-item__info">
                            <p class="ld-add-result-item__title">${escapeHtml(f.title)}</p>
                            ${meta ? `<p class="ld-add-result-item__meta">${meta}</p>` : ''}
                        </div>
                        <span class="ld-add-result-item__status">${isAdded ? '✓ Added' : '+ Add'}</span>
                    </button>
                `;
            }).join('');

            // Bind add-to-list actions
            results.querySelectorAll('.ld-add-result-item:not(.ld-add-result-item--added)').forEach(item => {
                item.addEventListener('click', async () => {
                    const tmdbId = item.dataset.tmdb;
                    try {
                        const res = await fetch(`/api/user/lists/${LIST_ID}/films/${tmdbId}`, { method: 'POST' });
                        if (res.ok || res.status === 409) {
                            item.classList.add('ld-add-result-item--added');
                            item.querySelector('.ld-add-result-item__status').textContent = '✓ Added';
                            addedTmdbIds.add(parseInt(tmdbId));
                            fetchFilms(); // refresh grid in background
                        }
                    } catch {
                        alert('Failed to add film.');
                    }
                });
            });

        } catch {
            results.innerHTML = '<p class="ld-add-results__hint">Failed to search. Try again.</p>';
        }
    }
}

// Handles confirmation modal for removing a film from the list
function initRemoveFilmModal() {
    if (!IS_OWNER) return;

    const overlay = document.getElementById('ldRemoveFilmOverlay');
    const closeBtn = document.getElementById('ldRemoveFilmClose');
    const cancelBtn = document.getElementById('ldRemoveFilmCancel');
    const confirmBtn = document.getElementById('ldRemoveFilmConfirm');

    let pendingTmdbId = null;

    // Expose global handler used by film card
    window.openRemoveFilmModal = (tmdbId, title) => {
        pendingTmdbId = tmdbId;
        document.getElementById('ldRemoveFilmTitle').textContent = title;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Close modal helper
    const close = () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        pendingTmdbId = null;
    };

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Confirm removal
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

// Escapes HTML special characters to prevent XSS in dynamically rendered content
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Initializes all UI modules and triggers initial data loading
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
    fetchFilms();
}

init();