const FILMS_SEARCH_API = '/api/search';
let filmsSearchDebounceTimer = null;

// Initializes film search input and handlers
function initFilmsSearch() {
    const input = document.getElementById('filmsSearchInput');
    const clearBtn = document.getElementById('filmsSearchClear');
    const suggestionsEl = document.getElementById('filmsSearchSuggestions');
    if (!input) return;

    input.addEventListener('input', function () {
        clearTimeout(filmsSearchDebounceTimer);
        const q = input.value.trim();
        clearBtn.style.display = q ? 'block' : 'none';

        if (q.length < 2) {
            hideSuggestions(suggestionsEl);
            return;
        }
        filmsSearchDebounceTimer = setTimeout(() => fetchFilmsSuggestions(q, suggestionsEl), 300);
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            hideSuggestions(suggestionsEl);
            const q = input.value.trim();
            if (firstFilmId) {
                window.location.href = '/film/' + firstFilmId;
            }
        }
        if (e.key === 'Escape') hideSuggestions(suggestionsEl);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            input.value = '';
            clearBtn.style.display = 'none';
            hideSuggestions(suggestionsEl);
            if (typeof setFilmsSearch === 'function') setFilmsSearch('');
        });
    }

    document.addEventListener('click', function (e) {
        if (!e.target.closest('#filmsSearchWrapper')) hideSuggestions(suggestionsEl);
    });
}

let firstFilmId = null;

// Fetches film suggestions by query
async function fetchFilmsSuggestions(q, suggestionsEl) {
    try {
        const res = await fetch(`${FILMS_SEARCH_API}?q=${encodeURIComponent(q)}&type=film&limit=20`);
        const data = await res.json();
        const films = data.films || [];
        firstFilmId = films.length ? films[0].tmdb_id : null;
        renderFilmsSuggestions(films, suggestionsEl);
    } catch {
        hideSuggestions(suggestionsEl);
    }
}

// Renders film suggestions list
function renderFilmsSuggestions(films, el) {
    if (!films.length) { hideSuggestions(el); return; }

    el.innerHTML = films.map(function (f) {
        const year = f.release_date ? new Date(f.release_date).getFullYear() : '';
        const rating = f.vote_average ? '★ ' + Number(f.vote_average).toFixed(1) : '';
        return '<a href="/film/' + f.tmdb_id + '" class="suggestion-item">' +
            '<div class="suggestion-item__info">' +
                '<span class="suggestion-item__title">' + escapeHtml(f.title) + '</span>' +
                '<span class="suggestion-item__meta">' +
                    (year ? year : '') +
                    (year && rating ? ' · ' : '') +
                    (rating ? rating : '') +
                '</span>' +
            '</div>' +
        '</a>';
    }).join('');

    el.style.display = 'block';
}

// Hides suggestions dropdown
function hideSuggestions(el) {
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
}

// Escapes HTML to prevent XSS
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

initFilmsSearch();