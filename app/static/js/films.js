const API = '/api';

const state = {
    sort: 'popular',
    trending_period: null,
    upcoming: false,
    genre_id: null,
    year: null,
    year_from: null,
    year_to: null,
    runtime_min: null,
    runtime_max: null,
    page: 1,
    total: 0,
    pages: 0,
    loading: false,
};

const durationLabels = {
    short: 'Short · < 90 min',
    standard: 'Standard · 90–150 min',
    long: 'Long · > 150 min',
};

const filmsGrid = document.getElementById('filmsGrid');
const resultsCount = document.getElementById('resultsCount');
const pagination = document.getElementById('pagination');
const activeFilters = document.getElementById('activeFilters');
const resetBtn = document.getElementById('resetFilters');

// Fetch
async function fetchFilms() {
    if (state.loading) return;
    state.loading = true;
    renderSkeletons();

    const params = new URLSearchParams({ page: state.page });

    if (state.trending_period && !state.runtime_min && !state.runtime_max) {
        params.set('trending_period', state.trending_period);
        if (state.genre_id) params.set('genre_id', state.genre_id);
    } else {
        params.set('sort', state.sort);
        if (state.upcoming) params.set('upcoming', 'true');
        if (state.genre_id) params.set('genre_id', state.genre_id);
        if (state.year) params.set('year', state.year);
        if (state.year_from) params.set('year_from', state.year_from);
        if (state.year_to) params.set('year_to', state.year_to);
        if (state.runtime_min) params.set('runtime_min', state.runtime_min);
        if (state.runtime_max) params.set('runtime_max', state.runtime_max);
    }

    try {
        const res = await fetch(`${API}/film/catalog?${params}`);
        const data = await res.json();
        state.total = data.total;
        state.pages = data.pages;
        renderFilms(data.films);
        renderPagination();
        renderResultsCount();
        updateURL();
    } catch {
        filmsGrid.innerHTML = '<p class="films-empty">Failed to load films. Please try again.</p>';
    } finally {
        state.loading = false;
    }
}

// Render
function renderFilms(films) {
    if (!films.length) {
        filmsGrid.innerHTML = '<p class="films-empty">No films found for selected filters.</p>';
        return;
    }
    filmsGrid.innerHTML = films.map(function(film) {
        return '<a href="/film/' + film.tmdb_id + '" class="film-card">' +
            (film.poster_url
                ? '<img class="film-card__poster" src="' + film.poster_url + '" alt="' + escapeHtml(film.title) + '" loading="lazy">'
                : '<div class="film-card__no-poster">No Image</div>'
            ) +
            '<div class="film-card__info">' +
                '<p class="film-card__title">' + escapeHtml(film.title) + '</p>' +
                '<p class="film-card__meta">' +
                    (film.release_date ? new Date(film.release_date).getFullYear() : '') +
                    ' <span class="film-card__rating">★ ' + Number(film.vote_average).toFixed(1) + '</span>' +
                '</p>' +
            '</div>' +
        '</a>';
    }).join('');
}

function renderSkeletons() {
    var html = '';
    for (var i = 0; i < 20; i++) { html += '<div class="film-card-skeleton"></div>'; }
    filmsGrid.innerHTML = html;
}

// Pagination
function renderPagination() {
    if (state.pages <= 1) { pagination.innerHTML = ''; return; }
    var p = state.page;
    var total = state.pages;
    var pages = [];
    if (total <= 7) {
        for (var i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if (p > 3) pages.push('...');
        for (var i = Math.max(2, p - 1); i <= Math.min(total - 1, p + 1); i++) pages.push(i);
        if (p < total - 2) pages.push('...');
        pages.push(total);
    }
    var html = '<button class="page-btn" onclick="changePage(' + (p - 1) + ')" ' + (p === 1 ? 'disabled' : '') + '>‹</button>';
    for (var i = 0; i < pages.length; i++) {
        var pg = pages[i];
        if (pg === '...') {
            html += '<span class="page-dots">…</span>';
        } else {
            html += '<button class="page-btn ' + (pg === p ? 'active' : '') + '" onclick="changePage(' + pg + ')">' + pg + '</button>';
        }
    }
    html += '<button class="page-btn" onclick="changePage(' + (p + 1) + ')" ' + (p === total ? 'disabled' : '') + '>›</button>';
    pagination.innerHTML = html;
}

function changePage(page) {
    if (page < 1 || page > state.pages || state.loading) return;
    state.page = page;
    fetchFilms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderResultsCount() {
    var from = (state.page - 1) * 20 + 1;
    var to = Math.min(state.page * 20, state.total);
    resultsCount.textContent = 'Showing ' + from + '–' + to + ' of ' + state.total.toLocaleString() + ' films';
}

// Active filter tags
function renderActiveFilters() {
    var tags = [];
    var sortLabel = document.getElementById('sortLabel').textContent;
    if (sortLabel !== 'Sort') tags.push({ label: sortLabel, key: 'sort' });
    if (state.genre_id) {
        var genreBtn = document.querySelector('.filter-option[data-filter="genre"][data-value="' + state.genre_id + '"]');
        tags.push({ label: genreBtn ? genreBtn.textContent.trim() : 'Genre', key: 'genre' });
    }
    if (state.year) tags.push({ label: '' + state.year, key: 'year' });
    if (state.year_from && state.year_to) tags.push({ label: state.year_from + 's', key: 'decade' });
    if (state.runtime_min || state.runtime_max) {
        var durBtn = document.querySelector('.filter-option[data-filter="duration"].selected');
        tags.push({ label: durBtn ? durationLabels[durBtn.dataset.value] : 'Duration', key: 'duration' });
    }

    var html = '';
    for (var i = 0; i < tags.length; i++) {
        html += '<span class="active-filter-tag">' + escapeHtml(tags[i].label) +
            '<button class="active-filter-tag__remove" onclick="removeFilter(\'' + tags[i].key + '\')">×</button></span>';
    }
    activeFilters.innerHTML = html;
    resetBtn.style.display = tags.length ? 'block' : 'none';
}

function removeFilter(key) {
    if (key === 'sort') {
        state.sort = 'popular';
        state.trending_period = null;
        state.upcoming = false;
        document.getElementById('sortLabel').textContent = 'Sort';
        document.getElementById('sortBtn').classList.remove('active');
        toggleYearFilter(false);
    }
    if (key === 'genre') {
        state.genre_id = null;
        document.getElementById('genreLabel').textContent = 'Genre';
        document.getElementById('genreBtn').classList.remove('active');
    }
    if (key === 'year') {
        state.year = null;
        document.getElementById('yearLabel').textContent = 'Year';
        document.getElementById('yearBtn').classList.remove('active');
        removeYearSubmenu();
    }
    if (key === 'decade') {
        state.year_from = null;
        state.year_to = null;
        document.getElementById('yearLabel').textContent = 'Year';
        document.getElementById('yearBtn').classList.remove('active');
        removeYearSubmenu();
    }
    if (key === 'duration') {
        state.runtime_min = null;
        state.runtime_max = null;
        document.getElementById('durationLabel').textContent = 'Duration';
        document.getElementById('durationBtn').classList.remove('active');
    }
    var selected = document.querySelectorAll('.filter-option.selected');
    for (var i = 0; i < selected.length; i++) selected[i].classList.remove('selected');
    state.page = 1;
    renderActiveFilters();
    fetchFilms();
}

// Year filter toggle
function toggleYearFilter(disabled) {
    var yearBtn = document.getElementById('yearBtn');
    yearBtn.disabled = disabled;
    yearBtn.style.opacity = disabled ? '0.4' : '1';
    yearBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    if (disabled) {
        state.year = null;
        state.year_from = null;
        state.year_to = null;
        document.getElementById('yearLabel').textContent = 'Year';
        yearBtn.classList.remove('active');
        removeYearSubmenu();
    }
}

// Dropdowns
function initDropdowns() {
    var dropdowns = document.querySelectorAll('.filter-dropdown');
    for (var i = 0; i < dropdowns.length; i++) {
        (function(dropdown) {
            var btn = dropdown.querySelector('.filter-btn');
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (btn.disabled) return;
                var isOpen = dropdown.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) dropdown.classList.add('open');
            });
        })(dropdowns[i]);
    }
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.filter-dropdown')) closeAllDropdowns();
    });
}

function closeAllDropdowns() {
    var open = document.querySelectorAll('.filter-dropdown.open');
    for (var i = 0; i < open.length; i++) open[i].classList.remove('open');
}

// Filter options
function initFilterOptions() {

    // Sort
    var sortBtns = document.querySelectorAll('.filter-option[data-filter="sort"]');
    for (var i = 0; i < sortBtns.length; i++) {
        (function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var siblings = btn.closest('.filter-dropdown__menu').querySelectorAll('.filter-option');
                for (var j = 0; j < siblings.length; j++) siblings[j].classList.remove('selected');
                btn.classList.add('selected');

                var value = btn.dataset.value;
                var label = btn.dataset.label;

                state.sort = 'popular';
                state.trending_period = null;
                state.upcoming = false;

                if (value === 'trending_day') {
                    state.trending_period = 'day';
                    toggleYearFilter(true);
                } else if (value === 'trending_week') {
                    state.trending_period = 'week';
                    toggleYearFilter(true);
                } else if (value === 'upcoming') {
                    state.upcoming = true;
                    state.sort = 'newest';
                    toggleYearFilter(false);
                } else {
                    state.sort = value;
                    toggleYearFilter(false);
                }

                document.getElementById('sortLabel').textContent = label;
                document.getElementById('sortBtn').classList.add('active');
                state.page = 1;
                closeAllDropdowns();
                renderActiveFilters();
                fetchFilms();
            });
        })(sortBtns[i]);
    }

    // Genre
    var genreBtns = document.querySelectorAll('.filter-option[data-filter="genre"]');
    for (var i = 0; i < genreBtns.length; i++) {
        (function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var siblings = btn.closest('.filter-dropdown__menu').querySelectorAll('.filter-option');
                for (var j = 0; j < siblings.length; j++) siblings[j].classList.remove('selected');
                btn.classList.add('selected');
                state.genre_id = btn.dataset.value ? parseInt(btn.dataset.value) : null;
                document.getElementById('genreLabel').textContent = btn.dataset.value ? 'Genre · ' + btn.textContent.trim() : 'Genre';
                document.getElementById('genreBtn').classList.toggle('active', !!btn.dataset.value);
                state.page = 1;
                closeAllDropdowns();
                renderActiveFilters();
                fetchFilms();
            });
        })(genreBtns[i]);
    }

    // Year — all years reset
    var yearBtns = document.querySelectorAll('.filter-option[data-filter="year"]');
    for (var i = 0; i < yearBtns.length; i++) {
        (function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                state.year = null;
                state.year_from = null;
                state.year_to = null;
                document.getElementById('yearLabel').textContent = 'Year';
                document.getElementById('yearBtn').classList.remove('active');
                removeYearSubmenu();
                var decadeBtns = document.querySelectorAll('.decade-btn');
                for (var j = 0; j < decadeBtns.length; j++) decadeBtns[j].classList.remove('selected');
                state.page = 1;
                closeAllDropdowns();
                renderActiveFilters();
                fetchFilms();
            });
        })(yearBtns[i]);
    }

    // Duration
    var durBtns = document.querySelectorAll('.filter-option[data-filter="duration"]');
    for (var i = 0; i < durBtns.length; i++) {
        (function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var siblings = btn.closest('.filter-dropdown__menu').querySelectorAll('.filter-option');
                for (var j = 0; j < siblings.length; j++) siblings[j].classList.remove('selected');
                btn.classList.add('selected');
                state.runtime_min = btn.dataset.min ? parseInt(btn.dataset.min) : null;
                state.runtime_max = btn.dataset.max ? parseInt(btn.dataset.max) : null;
                document.getElementById('durationLabel').textContent = btn.dataset.value ? 'Duration · ' + durationLabels[btn.dataset.value] : 'Duration';
                document.getElementById('durationBtn').classList.toggle('active', !!btn.dataset.value);
                state.page = 1;
                closeAllDropdowns();
                renderActiveFilters();
                fetchFilms();
            });
        })(durBtns[i]);
    }
}

// Decade submenu
function initDecadeButtons() {
    var decadeBtns = document.querySelectorAll('.decade-btn');
    for (var i = 0; i < decadeBtns.length; i++) {
        (function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var all = document.querySelectorAll('.decade-btn');
                for (var j = 0; j < all.length; j++) all[j].classList.remove('selected');
                btn.classList.add('selected');
                showYearSubmenu(parseInt(btn.dataset.decade));
            });
        })(decadeBtns[i]);
    }
}

function showYearSubmenu(decade) {
    removeYearSubmenu();
    var currentYear = new Date().getFullYear();
    var years = [];
    for (var y = decade; y <= decade + 9; y++) {
        if (y <= currentYear) years.push(y);
    }

    var yearsHtml = '';
    for (var i = 0; i < years.length; i++) {
        yearsHtml += '<button class="year-option" data-year="' + years[i] + '">' + years[i] + '</button>';
    }

    var submenu = document.createElement('div');
    submenu.className = 'year-submenu';
    submenu.id = 'yearSubmenu';
    submenu.innerHTML =
        '<div class="year-submenu__header">' +
            '<span class="year-submenu__title">Pick a year or</span>' +
            '<button class="year-submenu__decade-btn" data-decade="' + decade + '">' + decade + 's</button>' +
        '</div>' +
        '<div class="year-submenu__grid">' + yearsHtml + '</div>';

    document.getElementById('yearMenu').appendChild(submenu);

    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        state.year = null;
        state.year_from = decade;
        state.year_to = Math.min(decade + 9, currentYear);
        document.getElementById('yearLabel').textContent = 'Year · ' + decade + 's';
        document.getElementById('yearBtn').classList.add('active');
        state.page = 1;
        closeAllDropdowns();
        renderActiveFilters();
        fetchFilms();
    });

    var yearOptions = submenu.querySelectorAll('.year-option');
    for (var i = 0; i < yearOptions.length; i++) {
        (function(yBtn) {
            yBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                state.year = parseInt(yBtn.dataset.year);
                state.year_from = null;
                state.year_to = null;
                document.getElementById('yearLabel').textContent = 'Year · ' + state.year;
                document.getElementById('yearBtn').classList.add('active');
                state.page = 1;
                closeAllDropdowns();
                renderActiveFilters();
                fetchFilms();
            });
        })(yearOptions[i]);
    }
}

function removeYearSubmenu() {
    var sub = document.getElementById('yearSubmenu');
    if (sub) sub.parentNode.removeChild(sub);
}

// URL sync
function updateURL() {
    var params = new URLSearchParams();
    if (state.trending_period) params.set('trending_period', state.trending_period);
    else if (state.sort !== 'popular') params.set('sort', state.sort);
    if (state.upcoming) params.set('upcoming', 'true');
    if (state.genre_id) params.set('genre_id', state.genre_id);
    if (state.year) params.set('year', state.year);
    if (state.year_from) params.set('year_from', state.year_from);
    if (state.year_to) params.set('year_to', state.year_to);
    if (state.runtime_min) params.set('runtime_min', state.runtime_min);
    if (state.runtime_max) params.set('runtime_max', state.runtime_max);
    if (state.page > 1) params.set('page', state.page);
    var query = params.toString();
    history.replaceState({}, '', query ? '/films?' + query : '/films');
}

function loadFromURL() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('trending_period')) {
        state.trending_period = params.get('trending_period');
        toggleYearFilter(true);
    }
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('upcoming') === 'true') state.upcoming = true;
    if (params.get('genre_id')) state.genre_id = parseInt(params.get('genre_id'));
    if (params.get('year')) state.year = parseInt(params.get('year'));
    if (params.get('year_from')) state.year_from = parseInt(params.get('year_from'));
    if (params.get('year_to')) state.year_to = parseInt(params.get('year_to'));
    if (params.get('runtime_min')) state.runtime_min = parseInt(params.get('runtime_min'));
    if (params.get('runtime_max')) state.runtime_max = parseInt(params.get('runtime_max'));
    if (params.get('page')) state.page = parseInt(params.get('page'));
}

// Reset
if (resetBtn) {
    resetBtn.addEventListener('click', function() {
        state.sort = 'popular';
        state.trending_period = null;
        state.upcoming = false;
        state.genre_id = null;
        state.year = null;
        state.year_from = null;
        state.year_to = null;
        state.runtime_min = null;
        state.runtime_max = null;
        state.page = 1;

        document.getElementById('sortLabel').textContent = 'Sort';
        document.getElementById('genreLabel').textContent = 'Genre';
        document.getElementById('yearLabel').textContent = 'Year';
        document.getElementById('durationLabel').textContent = 'Duration';
        var filterBtns = document.querySelectorAll('.filter-btn');
        for (var i = 0; i < filterBtns.length; i++) filterBtns[i].classList.remove('active');
        var selectedBtns = document.querySelectorAll('.filter-option.selected');
        for (var i = 0; i < selectedBtns.length; i++) selectedBtns[i].classList.remove('selected');
        removeYearSubmenu();
        toggleYearFilter(false);

        renderActiveFilters();
        fetchFilms();
    });
}

// Utils
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Init
loadFromURL();
initDropdowns();
initFilterOptions();
initDecadeButtons();
renderActiveFilters();
fetchFilms();