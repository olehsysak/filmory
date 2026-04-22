const PAGE_SIZE = 20;
let allFilms = [];
let filteredFilms = [];
let visibleCount = PAGE_SIZE;

// state of active filters
const activeFilters = {
    job: '',
    sort: 'newest',
    year: '',
    year_from: null,
    year_to: null,
    genre: '',
    duration: '',
};

const filterLabels = {
    sort: { id: 'sortLabel', default: 'Sort' },
    job: { id: 'jobLabel', default: 'Role' },
    year: { id: 'yearLabel', default: 'Year' },
    genre: { id: 'genreLabel', default: 'Genre' },
    duration: { id: 'durationLabel', default: 'Duration' },
};

// Load data
async function init() {
    showLoading(); // skeleton before loading data
    try {
        const filmsRes = await fetch(`/api/person/${PERSON_TMDB_ID}/films`);
        allFilms = await filmsRes.json();

        const jobsRes = await fetch(`/api/person/${PERSON_TMDB_ID}/jobs`);
        const { jobs } = await jobsRes.json();

        populateJobFilter(jobs);
        populateGenreFilter();
        applyFilters();
        initDecadeButtons();
    } catch (e) {
        console.error('Error loading person data:', e);
        showError();
    }
}

// Loading states
function showLoading() {
    const grid = document.getElementById('filmsGrid');
    grid.innerHTML = Array(10).fill(`
        <div class="film-card">
            <div class="film-card__poster skeleton-box"></div>
            <div class="film-card__info">
                <div class="skeleton-box" style="height:12px;width:80%;border-radius:4px;margin-bottom:6px;"></div>
                <div class="skeleton-box" style="height:10px;width:50%;border-radius:4px;"></div>
            </div>
        </div>
    `).join('');

    document.getElementById('filmsCount').textContent = 'Loading...';
}

// fallback on API error
function showError() {
    document.getElementById('filmsGrid').innerHTML =
        '<p style="color:var(--text-muted);font-size:14px;grid-column:1/-1;">Failed to load films. Please try again.</p>';
    document.getElementById('filmsCount').textContent = '';
}

// Populate filters
function populateJobFilter(jobs) {
    const menu = document.getElementById('jobMenu');
    jobs.forEach(job => {
        const btn = document.createElement('button');
        btn.className = 'filter-option';
        btn.dataset.filter = 'job';
        btn.dataset.value = job;
        btn.dataset.label = `Role · ${job}`;
        btn.textContent = job;
        menu.appendChild(btn);
    });
}

// Creating genres from all movies
function populateGenreFilter() {
    const genreMap = {};
    allFilms.forEach(f => f.genres.forEach(g => genreMap[g.id] = g.name));

    const menu = document.getElementById('genreMenu');
    Object.entries(genreMap)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([id, name]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-option';
            btn.dataset.filter = 'genre';
            btn.dataset.value = id;
            btn.dataset.label = `Genre · ${name}`;
            btn.textContent = name;
            menu.appendChild(btn);
        });
}

// Dropdowns
// Close all open dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown.open').forEach(d => d.classList.remove('open'));
}

// Opening/closing dropdowns
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

    document.addEventListener('click', e => {
        if (!e.target.closest('.filter-dropdown')) closeAllDropdowns();
    });
}

// Filter options
function initFilterOptions() {
    document.addEventListener('click', e => {
        const option = e.target.closest('.filter-option');
        if (!option) return;

        const filter = option.dataset.filter;
        const value = option.dataset.value;
        const label = option.dataset.label;

        if (!filter) return;

        // Year reset button
        if (filter === 'year' && value === '') {
            activeFilters.year = '';
            activeFilters.year_from = null;
            activeFilters.year_to = null;
            document.getElementById('yearLabel').textContent = 'Year';
            document.getElementById('yearBtn').classList.remove('active');
            removeYearSubmenu();
            document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('selected'));
            closeAllDropdowns();
            updateActiveFilterTags();
            applyFilters();
            return;
        }

        if (filter === 'year') return; // handled by decade/year submenu

        // Update filter state
        activeFilters[filter] = value;

        // Update UI label
        const labelEl = document.getElementById(filterLabels[filter]?.id);
        if (labelEl) {
            labelEl.textContent = value ? label || value : filterLabels[filter].default;
        }

        // UI: selected state
        const menu = option.closest('.filter-dropdown__menu');
        if (menu) {
            menu.querySelectorAll('.filter-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        }

        const dropdownBtn = option.closest('.filter-dropdown')?.querySelector('.filter-btn');
        if (dropdownBtn) dropdownBtn.classList.toggle('active', !!value);

        option.closest('.filter-dropdown')?.classList.remove('open');

        updateActiveFilterTags();
        applyFilters();
    });
}

// Year submenu
// Initialization of decade buttons
function initDecadeButtons() {
    document.querySelectorAll('.decade-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            showYearSubmenu(parseInt(btn.dataset.decade));
        });
    });
}

// create a dynamic menu of years within a decade
function showYearSubmenu(decade) {
    removeYearSubmenu();

    const currentYear = new Date().getFullYear();

    // generate a list of years within a decade
    const years = [];
    for (let y = decade; y <= decade + 9; y++) {
        if (y <= currentYear) years.push(y);
    }

    const submenu = document.createElement('div');
    submenu.className = 'year-submenu';
    submenu.id = 'yearSubmenu';
    submenu.innerHTML = `
        <div class="year-submenu__header">
            <span class="year-submenu__title">Pick a year or</span>
            <button class="year-submenu__decade-btn" data-decade="${decade}">${decade}s</button>
        </div>
        <div class="year-submenu__grid">
            ${years.map(y => `<button class="year-option" data-year="${y}">${y}</button>`).join('')}
        </div>
    `;

    document.getElementById('yearMenu').appendChild(submenu);

    submenu.querySelector('.year-submenu__decade-btn').addEventListener('click', e => {
        e.stopPropagation();
        activeFilters.year = `${decade}s`;
        activeFilters.year_from = decade;
        activeFilters.year_to = Math.min(decade + 9, currentYear);
        document.getElementById('yearLabel').textContent = `Year · ${decade}s`;
        document.getElementById('yearBtn').classList.add('active');
        closeAllDropdowns();
        updateActiveFilterTags();
        applyFilters();
    });

    submenu.querySelectorAll('.year-option').forEach(yBtn => {
        yBtn.addEventListener('click', e => {
            e.stopPropagation();
            activeFilters.year = parseInt(yBtn.dataset.year);
            activeFilters.year_from = null;
            activeFilters.year_to = null;
            document.getElementById('yearLabel').textContent = `Year · ${activeFilters.year}`;
            document.getElementById('yearBtn').classList.add('active');
            closeAllDropdowns();
            updateActiveFilterTags();
            applyFilters();
        });
    });
}

// Remove submenu (clean up DOM)
function removeYearSubmenu() {
    const sub = document.getElementById('yearSubmenu');
    if (sub) sub.remove();
}

// Active filter tags
function updateActiveFilterTags() {
    const container = document.getElementById('activeFilters');
    const resetBtn = document.getElementById('resetFilters');

    const tags = Object.entries(activeFilters)
        .filter(([key, val]) => {
            if (key === 'year_from' || key === 'year_to') return false;
            if (key === 'sort' && val === 'newest') return false;
            return !!val;
        })
        .map(([key, val]) => {
            const labelEl = document.getElementById(filterLabels[key]?.id);
            const label = labelEl?.textContent || val;
            return `
                <span class="active-filter-tag">
                    ${label}
                    <button class="active-filter-tag__remove" data-filter="${key}">×</button>
                </span>
            `;
        });

    container.innerHTML = tags.join('');
    resetBtn.style.display = tags.length ? 'block' : 'none';

    container.querySelectorAll('.active-filter-tag__remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;

            if (filter === 'year') {
                activeFilters.year = '';
                activeFilters.year_from = null;
                activeFilters.year_to = null;
                document.getElementById('yearLabel').textContent = 'Year';
                document.getElementById('yearBtn').classList.remove('active');
                removeYearSubmenu();
                document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('selected'));
            } else {
                activeFilters[filter] = filter === 'sort' ? 'newest' : '';
                const labelEl = document.getElementById(filterLabels[filter]?.id);
                if (labelEl) labelEl.textContent = filterLabels[filter].default;
                const dropdown = document.getElementById(`${filter}Dropdown`);
                dropdown?.querySelectorAll('.filter-option').forEach(o => {
                    o.classList.toggle('selected', o.dataset.value === activeFilters[filter] || o.dataset.value === '');
                });
                dropdown?.querySelector('.filter-btn')?.classList.remove('active');
            }

            updateActiveFilterTags();
            applyFilters();
        });
    });
}

// Reset
document.getElementById('resetFilters').addEventListener('click', () => {
    activeFilters.job = '';
    activeFilters.sort = 'newest';
    activeFilters.year = '';
    activeFilters.year_from = null;
    activeFilters.year_to = null;
    activeFilters.genre = '';
    activeFilters.duration = '';


    // UI: Clear active states
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.filter-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.value === '' || (o.dataset.filter === 'sort' && o.dataset.value === 'newest'));
    });

    // Return default labels
    Object.values(filterLabels).forEach(({ id, default: def }) => {
        const el = document.getElementById(id);
        if (el) el.textContent = def;
    });
    removeYearSubmenu();
    document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('selected'));

    updateActiveFilterTags();
    applyFilters();
});

// Apply filters
function applyFilters() {
    const today = new Date();

    filteredFilms = allFilms.filter(f => {
        const releaseDate = f.release_date ? new Date(f.release_date) : null;
        const releaseYear = releaseDate ? releaseDate.getFullYear() : null;

        // job filter
        if (activeFilters.job && !f.jobs.includes(activeFilters.job)) return false;

        // year range filter
        if (activeFilters.year_from && activeFilters.year_to) {
            if (!releaseYear || releaseYear < activeFilters.year_from || releaseYear > activeFilters.year_to) return false;
        } else if (activeFilters.year && !activeFilters.year_from) {
            if (!releaseYear || releaseYear !== parseInt(activeFilters.year)) return false;
        }

        // genre filter
        if (activeFilters.genre && !f.genres.some(g => String(g.id) === activeFilters.genre)) return false;

        // duration filters
        if (activeFilters.duration === 'short' && (!f.runtime || f.runtime >= 90)) return false;
        if (activeFilters.duration === 'medium' && (!f.runtime || f.runtime < 90 || f.runtime > 150)) return false;
        if (activeFilters.duration === 'long' && (!f.runtime || f.runtime <= 150)) return false;

        // sorting-based filtering
        if (activeFilters.sort === 'upcoming') {
            if (!releaseDate || releaseDate <= today) return false;
        } else if (activeFilters.sort === 'newest' || activeFilters.sort === 'oldest') {
            if (!releaseDate || releaseDate > today) return false;
        }

        return true;
    });

    filteredFilms.sort((a, b) => {
        switch (activeFilters.sort) {
            case 'newest': return new Date(b.release_date) - new Date(a.release_date);
            case 'oldest': return new Date(a.release_date) - new Date(b.release_date);
            case 'upcoming': return new Date(a.release_date) - new Date(b.release_date);
            case 'highest': return b.vote_average - a.vote_average;
            case 'lowest': return a.vote_average - b.vote_average;
            case 'popular': return b.popularity - a.popularity;
            default: return 0;
        }
    });

    visibleCount = PAGE_SIZE; // reset pagination on filter change
    renderFilms();
}

// Render
function renderFilms() {
    const grid = document.getElementById('filmsGrid');
    const count = document.getElementById('filmsCount');
    const loadMoreWrapper = document.getElementById('loadMoreWrapper');
    const visible = filteredFilms.slice(0, visibleCount);

    count.textContent = `${filteredFilms.length} film${filteredFilms.length !== 1 ? 's' : ''}`;

    if (!visible.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;grid-column:1/-1;">No films found.</p>';
        loadMoreWrapper.style.display = 'none';
        return;
    }

    grid.innerHTML = visible.map(f => `
        <a href="/film/${f.tmdb_id}" class="film-card">
            ${f.poster_url
                ? `<img class="film-card__poster" src="${f.poster_url}" alt="${f.title}" loading="lazy">`
                : `<div class="film-card__no-poster">No Image</div>`
            }
            <div class="film-card__info">
                <p class="film-card__title">${f.title}</p>
                <p class="film-card__meta">
                    ${f.release_date ? new Date(f.release_date).getFullYear() : ''}
                    <span class="film-card__rating">★ ${f.vote_average.toFixed(1)}</span>
                </p>
                ${f.jobs?.length ? `<p style="font-size:11px;color:var(--text-muted);margin-top:2px;">${f.jobs.join(', ')}</p>` : ''}
                ${f.character ? `<p style="font-size:11px;color:var(--text-muted);margin-top:2px;">${f.character}</p>` : ''}
            </div>
        </a>
    `).join('');

    loadMoreWrapper.style.display = visibleCount < filteredFilms.length ? 'flex' : 'none';
}

// Load more
document.getElementById('loadMoreBtn').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderFilms();
});

// Bio toggle
const bioText = document.getElementById('bioText');
const bioToggle = document.getElementById('bioToggle');
if (bioText && bioToggle) {
    bioToggle.addEventListener('click', () => {
        const expanded = bioText.classList.toggle('person-sidebar__bio-text--expanded');
        bioToggle.textContent = expanded ? 'Show less' : 'Show more';
    });
}

// Init
initDropdowns();
initFilterOptions();
init();