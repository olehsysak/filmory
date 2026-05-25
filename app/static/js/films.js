const API = '/api';

// Global state storing all active filters, pagination, and loading status
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
    q: null,
};

const durationLabels = {
    short: 'Short · < 90 min',
    standard: 'Standard · 90–150 min',
    long: 'Long · > 150 min',
};

const sortLabels = {
    popular:        'Popularity · All Time',
    trending_day:   'Trending · Today',
    trending_week:  'Trending · This Week',
    top_rated:      'Rating · Highest',
    lowest_rated:   'Rating · Lowest',
};

// DOM references for main UI containers
const filmsGrid = document.getElementById('filmsGrid');
const resultsCount = document.getElementById('resultsCount');
const pagination = document.getElementById('pagination');
const activeFilters = document.getElementById('activeFilters');
const resetBtn = document.getElementById('resetFilters');

// Fetch films from API based on current state filters and pagination
async function fetchFilms() {
    if (state.loading) return;
    state.loading = true;
    renderSkeletons();

    let url;
    const params = new URLSearchParams({ page: state.page });

    // Build search request if query exists
    if (state.q) {
        url = `${API}/search?q=${encodeURIComponent(state.q)}&type=film&limit=20`;

    // Handle trending request with optional filters
    } else if (state.trending_period) {
        params.set('trending_period', state.trending_period);
        if (state.genre_id) params.set('genre_id', state.genre_id);
        url = `${API}/film/catalog?${params}`;

    // Handle default catalog request with filters
    } else {
        params.set('sort', state.sort);
        if (state.upcoming) params.set('upcoming', 'true');
        if (state.genre_id) params.set('genre_id', state.genre_id);
        if (state.year) params.set('year', state.year);
        if (state.year_from) params.set('year_from', state.year_from);
        if (state.year_to) params.set('year_to', state.year_to);
        if (state.runtime_min) params.set('runtime_min', state.runtime_min);
        if (state.runtime_max) params.set('runtime_max', state.runtime_max);
        url = `${API}/film/catalog?${params}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        // Extract films and pagination metadata from response
        const films = data.films || [];
        state.total = data.total || films.length;
        state.pages = data.pages || 1;

        // Render UI based on fetched data
        renderFilms(films);
        renderPagination();
        renderResultsCount();
        updateURL();

    } catch {
        filmsGrid.innerHTML = '<p class="films-empty">Failed to load films. Please try again.</p>';
    } finally {
        state.loading = false;
    }
}

// Render film cards into the grid
function renderFilms(films) {
    if (!films || !films.length) {
        filmsGrid.innerHTML = '<p class="films-empty">No films found for selected filters.</p>';
        return;
    }

    filmsGrid.innerHTML = films.map(function(film) {
        var rating = film.vote_average ? '★ ' + Number(film.vote_average).toFixed(1) : '';
        var year = film.release_date ? new Date(film.release_date).getFullYear() : '';

        return '<a href="/film/' + film.tmdb_id + '" class="film-card">' +
            (film.poster_url
                ? '<img class="film-card__poster" src="' + film.poster_url + '" alt="' + escapeHtml(film.title) + '" loading="lazy">'
                : '<div class="film-card__no-poster">No Image</div>'
            ) +
            '<div class="film-card__info">' +
                '<p class="film-card__title">' + escapeHtml(film.title) + '</p>' +
                '<p class="film-card__meta">' + year +
                    (rating ? '<span class="film-card__rating">' + rating + '</span>' : '') +
                '</p>' +
            '</div>' +
        '</a>';
    }).join('');
}

// Render loading skeleton cards while fetching data
function renderSkeletons() {
    filmsGrid.innerHTML = Array(20).fill('<div class="film-card-skeleton"></div>').join('');
}

// Render pagination controls with page grouping and ellipsis
function renderPagination() {
    var p = state.page;
    var total = state.pages;
    if (total <= 1) { pagination.innerHTML = ''; return; }

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

// Change current page and reload films
function changePage(page) {
    if (page < 1 || page > state.pages || state.loading) return;
    state.page = page;
    fetchFilms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render text showing current results range
function renderResultsCount() {
    var from = (state.page - 1) * 20 + 1;
    var to = Math.min(state.page * 20, state.total);
    resultsCount.textContent = 'Showing ' + from + '–' + to + ' of ' + state.total.toLocaleString() + ' films';
}

// Render active filter tags based on current state
function renderActiveFilters() {
    var tags = [];

    if (state.upcoming) {
        tags.push({ label: 'Year · Upcoming', key: 'upcoming' });
    } else if (state.trending_period === 'day') {
        tags.push({ label: 'Sort · Trending · Today', key: 'sort' });
    } else if (state.trending_period === 'week') {
        tags.push({ label: 'Sort · Trending · This Week', key: 'sort' });
    } else if (state.sort !== 'popular') {
        tags.push({ label: 'Sort · ' + (sortLabels[state.sort] || state.sort), key: 'sort' });
    }

    if (state.genre_id) {
        var genreBtn = document.querySelector('.filter-option[data-filter="genre"][data-value="' + state.genre_id + '"]');
        tags.push({ label: 'Genre · ' + (genreBtn ? genreBtn.textContent.trim() : 'Genre'), key: 'genre' });
    }
    if (state.year) {
        tags.push({ label: 'Year · ' + state.year, key: 'year' });
    }
    if (state.year_from && state.year_to) {
        tags.push({ label: 'Year · ' + state.year_from + 's', key: 'decade' });
    }
    if (state.runtime_min || state.runtime_max) {
        var durBtn = document.querySelector('.filter-option[data-filter="duration"].selected');
        tags.push({ label: 'Duration · ' + (durBtn ? durationLabels[durBtn.dataset.value] : ''), key: 'duration' });
    }

    var html = '';
    for (var i = 0; i < tags.length; i++) {
        html += '<span class="active-filter-tag">' + escapeHtml(tags[i].label) +
            '<button class="active-filter-tag__remove" onclick="removeFilter(\'' + tags[i].key + '\')">×</button></span>';
    }
    activeFilters.innerHTML = html;
    resetBtn.style.display = tags.length ? 'block' : 'none';
}

// Remove a specific filter and refresh results
function removeFilter(key) {
    if (key === 'sort') {
        state.sort = 'popular';
        state.trending_period = null;
        document.querySelectorAll('.filter-option[data-filter="sort"]').forEach(function(b) { b.classList.remove('selected'); });
        var popularBtn = document.querySelector('.filter-option[data-value="popular"]');
        if (popularBtn) popularBtn.classList.add('selected');
        toggleYearFilter(false);
    }
    if (key === 'upcoming') {
        state.upcoming = false;
        document.getElementById('yearBtn').classList.remove('active');
    }
    if (key === 'genre') {
        state.genre_id = null;
        document.getElementById('genreBtn').classList.remove('active');
        document.querySelectorAll('.filter-option[data-filter="genre"]').forEach(function(b) { b.classList.remove('selected'); });
    }
    if (key === 'year') {
        state.year = null;
        document.getElementById('yearBtn').classList.remove('active');
        removeYearSubmenu();
    }
    if (key === 'decade') {
        state.year_from = null;
        state.year_to = null;
        document.getElementById('yearBtn').classList.remove('active');
        removeYearSubmenu();
    }
    if (key === 'duration') {
        state.runtime_min = null;
        state.runtime_max = null;
        document.getElementById('durationBtn').classList.remove('active');
        document.querySelectorAll('.filter-option[data-filter="duration"]').forEach(function(b) {
            b.classList.remove('selected');
        });
    }
    state.page = 1;
    renderActiveFilters();
    fetchFilms();
}

// Disable or enable year filter depending on trending mode
function toggleYearFilter(disabled) {
    var yearBtn = document.getElementById('yearBtn');
    yearBtn.disabled = disabled;
    yearBtn.style.opacity = disabled ? '0.4' : '1';
    yearBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';

    if (disabled) {
        state.year = null;
        state.year_from = null;
        state.year_to = null;
        state.upcoming = false;
        document.getElementById('yearLabel').textContent = 'YEAR';
        yearBtn.classList.remove('active');
        removeYearSubmenu();
    }
}

// Initialize all filter option event listeners
function initFilterOptions() {
    // Sort filter click handlers
    document.querySelectorAll('.filter-option[data-filter="sort"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var value = btn.dataset.value;
            var label = btn.dataset.label || btn.textContent.trim();

            state.sort = 'popular';
            state.trending_period = null;
            state.upcoming = false;

            if (value === 'trending_day') {
                state.trending_period = 'day';
                toggleYearFilter(true);
            } else if (value === 'trending_week') {
                state.trending_period = 'week';
                toggleYearFilter(true);
            } else {
                state.sort = value;
                toggleYearFilter(false);
            }

            document.querySelectorAll('.filter-option[data-filter="sort"]').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');

            document.getElementById('sortBtn').classList.add('active');
            state.page = 1;
            renderActiveFilters();
            fetchFilms();
        });
    });

    // Upcoming filter click handlers
    document.querySelectorAll('.filter-option[data-filter="upcoming"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();

            state.upcoming = true;
            state.year = null;
            state.year_from = null;
            state.year_to = null;
            state.sort = 'popular';

            removeYearSubmenu();

            document.getElementById('yearBtn').classList.add('active');

            state.page = 1;
            renderActiveFilters();
            fetchFilms();
        });
    });

    // Year reset filter click handlers
    document.querySelectorAll('.filter-option[data-filter="year"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();

            state.year = null;
            state.year_from = null;
            state.year_to = null;
            state.upcoming = false;

            document.getElementById('yearLabel').textContent = 'YEAR';
            document.getElementById('yearBtn').classList.remove('active');

            removeYearSubmenu();

            document.querySelectorAll('.decade-btn').forEach(function(b) { b.classList.remove('selected'); });

            state.page = 1;
            renderActiveFilters();
            fetchFilms();
        });
    });

    // Genre filter click handlers
    document.querySelectorAll('.filter-option[data-filter="genre"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            state.genre_id = btn.dataset.value ? parseInt(btn.dataset.value) : null;

            document.querySelectorAll('.filter-option[data-filter="genre"]').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');

            document.getElementById('genreBtn').classList.toggle('active', !!btn.dataset.value);
            state.page = 1;
            renderActiveFilters();
            fetchFilms();
        });
    });

    // Duration filter click handlers
    document.querySelectorAll('.filter-option[data-filter="duration"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();

            document.querySelectorAll('.filter-option[data-filter="duration"]').forEach(function(b) {
                b.classList.remove('selected');
            });

            btn.classList.add('selected');
            state.runtime_min = btn.dataset.min ? parseInt(btn.dataset.min) : null;
            state.runtime_max = btn.dataset.max ? parseInt(btn.dataset.max) : null;

            document.getElementById('durationBtn').classList.toggle('active', !!btn.dataset.value);
            state.page = 1;
            renderActiveFilters();
            fetchFilms();
        });
    });
}

// Initialize decade button click handlers
function initDecadeButtons() {
    document.querySelectorAll('.decade-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();

            // Remove active state from all decade buttons
            document.querySelectorAll('.decade-btn').forEach(function(b) {
                b.classList.remove('selected');
            });

            btn.classList.add('selected');
            showYearSubmenu(parseInt(btn.dataset.decade));
        });
    });
}

// Render submenu containing years for selected decade
function showYearSubmenu(decade) {
    removeYearSubmenu();

    var currentYear = new Date().getFullYear();
    var years = [];

    // Generate valid years for selected decade
    for (var y = decade; y <= decade + 9; y++) {
        if (y <= currentYear) years.push(y);
    }

    // Generate year option buttons
    var yearsHtml = years.map(function(y) {
        return '<button class="year-option" data-year="' + y + '">' + y + '</button>';
    }).join('');

    // Create submenu container
    var submenu = document.createElement('div');
    submenu.className = 'year-submenu';
    submenu.id = 'yearSubmenu';

    submenu.innerHTML =
        '<div class="year-submenu__header">' +
            '<span class="year-submenu__title">Pick a year or</span>' +
            '<button class="year-submenu__decade-btn" data-decade="' + decade + '">' + decade + 's</button>' +
        '</div>' +
        '<div class="year-submenu__grid">' + yearsHtml + '</div>';

    // Insert submenu into year dropdown
    document.getElementById('yearMenu').appendChild(submenu);

    // Apply decade range filter when decade button is clicked
    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', function(e) {
        e.stopPropagation();

        state.year = null;
        state.upcoming = false;
        state.year_from = decade;
        state.year_to = Math.min(decade + 9, currentYear);

        document.getElementById('yearBtn').classList.add('active');

        state.page = 1;
        renderActiveFilters();
        fetchFilms();
    });

    // Apply specific year filter when year option is clicked
    submenu.querySelectorAll('.year-option').forEach(function(yBtn) {
        yBtn.addEventListener('click', function(e) {
            e.stopPropagation();

            state.year = parseInt(yBtn.dataset.year);
            state.year_from = null;
            state.year_to = null;
            state.upcoming = false;

            document.getElementById('yearBtn').classList.add('active');

            state.page = 1;
            renderActiveFilters();
            fetchFilms();
        });
    });
}

// Remove currently opened year submenu
function removeYearSubmenu() {
    var sub = document.getElementById('yearSubmenu');
    if (sub) sub.parentNode.removeChild(sub);
}

// Update browser URL based on current filter state
function updateURL() {
    var params = new URLSearchParams();

    if (state.trending_period) params.set('trending_period', state.trending_period);
    else if (state.sort !== 'popular') params.set('sort', state.sort);

    if (state.q) params.set('q', state.q);
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

// Restore filter state from URL parameters
function loadFromURL() {
    var params = new URLSearchParams(window.location.search);

    if (params.get('trending_period')) {
        state.trending_period = params.get('trending_period');
        toggleYearFilter(true);
    }

    if (params.get('q')) state.q = params.get('q');
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

// Synchronize UI elements with current application state
function syncUIFromState() {
    var sortBtn = document.getElementById('sortBtn');
    var sortLabel = document.getElementById('sortLabel');

    // Determine currently active sort option
    var activeValue = null;

    if (state.trending_period === 'day') activeValue = 'trending_day';
    else if (state.trending_period === 'week') activeValue = 'trending_week';
    else activeValue = state.sort; // 'popular' by default

    // Highlight active sort option in dropdown
    sortLabel.textContent = 'SORT';
    sortBtn.classList.add('active');

    var activeBtn = document.querySelector('.filter-option[data-value="' + activeValue + '"]');
    if (activeBtn) activeBtn.classList.add('selected');

    if (state.upcoming) {
        document.getElementById('yearBtn').classList.add('active');
    } else if (state.year) {
        document.getElementById('yearBtn').classList.add('active');
    } else if (state.year_from) {
        document.getElementById('yearBtn').classList.add('active');
    }

    if (state.genre_id) {
        var genreBtn = document.querySelector('.filter-option[data-filter="genre"][data-value="' + state.genre_id + '"]');
        if (genreBtn) {
            document.getElementById('genreLabel').textContent = 'Genre · ' + genreBtn.textContent.trim();
            document.getElementById('genreBtn').classList.add('active');
        }
    }

    if (state.runtime_min || state.runtime_max) {
        document.getElementById('durationBtn').classList.add('active');
        var durKey = (!state.runtime_min && state.runtime_max <= 90) ? 'short'
                   : (state.runtime_min >= 150) ? 'long' : 'standard';
        document.getElementById('durationLabel').textContent = 'Duration · ' + durationLabels[durKey];
    }
}

// Initialize reset button functionality
function initReset() {
    resetBtn.addEventListener('click', function() {
        // Reset all filters to default state
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
        state.q = null;

        // Clear search input field
        document.getElementById('filmsSearchInput').value = '';
        document.getElementById('filmsSearchClear').style.display = 'none';

        // Remove active state from optional filter buttons
        document.getElementById('yearBtn').classList.remove('active');
        document.getElementById('genreBtn').classList.remove('active');
        document.getElementById('durationBtn').classList.remove('active');

        // Clear all selected dropdown options
        document.querySelectorAll('.filter-option.selected').forEach(function(b) {
            b.classList.remove('selected');
        });

        // Restore default popular sort selection
        var popularBtn = document.querySelector('.filter-option[data-value="popular"]');
        if (popularBtn) popularBtn.classList.add('selected');

        removeYearSubmenu();
        toggleYearFilter(false);

        renderActiveFilters();
        fetchFilms();
    });
}

// Update search query and reload films
function setFilmsSearch(q) {
    state.q = q || null;
    state.page = 1;

    renderActiveFilters();
    fetchFilms();
}

// Expose search function globally for external usage
window.setFilmsSearch = setFilmsSearch;

// Escape unsafe HTML characters to prevent XSS
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Init
loadFromURL();
syncUIFromState();
initFilterOptions();
initDecadeButtons();
initReset();
renderActiveFilters();
fetchFilms();