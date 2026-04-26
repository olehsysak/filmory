const SEARCH_API = '/api/search';
let navbarDebounceTimer = null;

// Initializes navbar search and handlers
function initNavbarSearch() {
    const input = document.getElementById('searchInput');
    const suggestionsEl = document.getElementById('searchSuggestions');
    const submitBtn = document.getElementById('searchSubmitBtn');
    if (!input) return;

    input.addEventListener('input', function () {
        clearTimeout(navbarDebounceTimer);
        const q = input.value.trim();
        if (q.length < 2) { hideSuggestions(suggestionsEl); return; }
        navbarDebounceTimer = setTimeout(() => fetchSuggestions(q, suggestionsEl), 300);
    });

    submitBtn.addEventListener('click', function () {
        const q = input.value.trim();
        if (q) window.location.href = '/search?q=' + encodeURIComponent(q);
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            const q = input.value.trim();
            if (q) window.location.href = '/search?q=' + encodeURIComponent(q);
        }
        if (e.key === 'Escape') hideSuggestions(suggestionsEl);
    });

    document.addEventListener('click', function (e) {
        if (!e.target.closest('#searchForm')) hideSuggestions(suggestionsEl);
    });
}

// Fetches suggestions for films and people
async function fetchSuggestions(q, suggestionsEl) {
    try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(q)}&type=all`);
        const data = await res.json();
        renderSuggestions(data, suggestionsEl, q);
    } catch {
        hideSuggestions(suggestionsEl);
    }
}

// Renders suggestions dropdown (films + people)
function renderSuggestions(data, el, q) {
    const films = data.films || [];
    const persons = data.persons || [];

    if (!films.length && !persons.length) {
        hideSuggestions(el);
        return;
    }

    let html = '';

    if (films.length) {
        html += '<div class="suggestions__section-title">Films</div>';
        html += films.map(function (f) {
            const year = f.release_date ? new Date(f.release_date).getFullYear() : '';
            return '<a href="/film/' + f.tmdb_id + '" class="suggestion-item">' +
                '<div class="suggestion-item__info">' +
                    '<span class="suggestion-item__title">' + escapeHtml(f.title) + '</span>' +
                    (year ? '<span class="suggestion-item__meta">' + year + '</span>' : '') +
                '</div>' +
            '</a>';
        }).join('');
    }

    if (persons.length) {
        html += '<div class="suggestions__section-title">People</div>';
        html += persons.map(function (p) {
            return '<a href="/person/' + p.tmdb_id + '" class="suggestion-item">' +
                '<div class="suggestion-item__info">' +
                    '<span class="suggestion-item__title">' + escapeHtml(p.name) + '</span>' +
                    (p.known_for ? '<span class="suggestion-item__meta">' + escapeHtml(p.known_for) + '</span>' : '') +
                '</div>' +
            '</a>';
        }).join('');
    }

    html += '<a href="/search?q=' + encodeURIComponent(q) + '" class="suggestions__see-all">See all results →</a>';

    el.innerHTML = html;
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

initNavbarSearch();