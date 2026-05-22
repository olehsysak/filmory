const API = '/api/search';
const FILMS_PER_PAGE = 20;
const PERSONS_PER_PAGE = 20;
const MIXED_PER_PAGE = 20;
const MEMBERS_PER_PAGE = 20;
const LISTS_PER_PAGE = 20;

// Pagination and loaded counters for each search mode
let filmsPage = 1;
let personsPage = 1;
let mixedPage = 1;
let membersPage = 1;
let listsPage = 1;
let filmsLoaded = 0;
let personsLoaded = 0;
let mixedLoaded = 0;
let membersLoaded = 0;
let listsLoaded = 0;
let mixedNextPage = 1;

// DOM containers and UI elements for rendering search results
const filmsGrid = document.getElementById('filmsGrid');
const personsGrid = document.getElementById('personsGrid');
const mixedGrid = document.getElementById('mixedGrid');
const membersGrid = document.getElementById('membersGrid');
const listsGrid = document.getElementById('listsGrid');
const filmsMoreBtn = document.getElementById('filmsMoreBtn');
const personsMoreBtn = document.getElementById('personsMoreBtn');
const mixedMoreBtn = document.getElementById('mixedMoreBtn');
const membersMoreBtn = document.getElementById('membersMoreBtn');
const listsMoreBtn = document.getElementById('listsMoreBtn');
const filmsCount = document.getElementById('filmsCount');
const personsCount = document.getElementById('personsCount');
const mixedCount = document.getElementById('mixedCount');
const membersCount = document.getElementById('membersCount');
const listsCount = document.getElementById('listsCount');

// Sections
const allSection = document.getElementById('allSection');
const filmsSection = document.getElementById('filmsSection');
const peopleSection = document.getElementById('peopleSection');
const membersSection = document.getElementById('membersSection');
const listsSection = document.getElementById('listsSection');


// --- FETCH ---

// Fetch mixed search results (films + persons) from backend API
async function fetchMixed(page) {
    const res = await fetch(`${API}?q=${encodeURIComponent(SEARCH_QUERY)}&type=all&limit=${MIXED_PER_PAGE}&page=${page}`);
    const data = await res.json();
    mixedNextPage = data.next_page || (page + 1);
    return data.mixed || [];
}

// Fetch films search results
async function fetchFilms(page) {
    const res = await fetch(`${API}?q=${encodeURIComponent(SEARCH_QUERY)}&type=film&limit=${FILMS_PER_PAGE}&page=${page}`);
    const data = await res.json();
    return data.films || [];
}

// Fetch persons search results
async function fetchPersons(page) {
    const res = await fetch(`${API}?q=${encodeURIComponent(SEARCH_QUERY)}&type=person&limit=${PERSONS_PER_PAGE}&page=${page}`);
    const data = await res.json();
    return data.persons || [];
}

// Fetch members (users) search results
async function fetchMembers(page) {
    const res = await fetch(`${API}?q=${encodeURIComponent(SEARCH_QUERY)}&type=member&limit=${MEMBERS_PER_PAGE}&page=${page}`);
    const data = await res.json();
    return data.members || [];
}

// Fetch public lists search results
async function fetchLists(page) {
    const res = await fetch(`${API}?q=${encodeURIComponent(SEARCH_QUERY)}&type=list&limit=${LISTS_PER_PAGE}&page=${page}`);
    const data = await res.json();
    return data.lists || [];
}

// Render single film item into HTML row
function renderFilmRow(f) {
    const year = f.release_date ? new Date(f.release_date).getFullYear() : '';
    const rating = f.vote_average ? '★ ' + Number(f.vote_average).toFixed(1) : '';
    const meta = [year, rating].filter(Boolean).join(' · ');

    return '<a href="/film/' + f.tmdb_id + '" class="search-film-row">' +
        (f.poster_url
            ? '<img class="search-film-row__poster" src="' + f.poster_url + '" alt="" loading="lazy">'
            : '<div class="search-film-row__no-poster">No img</div>'
        ) +
        '<div class="search-film-row__info">' +
            '<p class="search-film-row__title">' + escapeHtml(f.title) + '</p>' +
            (meta ? '<p class="search-film-row__meta">' + meta + '</p>' : '') +
            (f.overview ? '<p class="search-film-row__overview">' + escapeHtml(f.overview) + '</p>' : '') +
        '</div>' +
    '</a>';
}

// Render single person item into HTML row
function renderPersonRow(p) {
    return '<a href="/person/' + p.tmdb_id + '" class="search-person-row">' +
        (p.profile_url
            ? '<img class="search-person-row__photo" src="' + p.profile_url + '" alt="" loading="lazy">'
            : '<img class="search-person-row__photo" src="/static/img/no-avatar.svg" alt="">'
        ) +
        '<div class="search-person-row__info">' +
            '<p class="search-person-row__name">' + escapeHtml(p.name) + '</p>' +
            (p.known_for ? '<p class="search-person-row__meta">' + escapeHtml(p.known_for) + '</p>' : '') +
            (p.top_film ? '<p class="search-person-row__film">Known for: ' + escapeHtml(p.top_film) + '</p>' : '') +
        '</div>' +
    '</a>';
}

// Render member (user) row — reuses search-person-row styles
function renderMemberRow(m) {
    return '<a href="/users/' + escapeHtml(m.username) + '" class="search-person-row">' +
        (m.avatar_url
            ? '<img class="search-person-row__photo" src="' + m.avatar_url + '" alt="" loading="lazy">'
            : '<img class="search-person-row__photo" src="/static/img/no-avatar.svg" alt="">'
        ) +
        '<div class="search-person-row__info">' +
            '<p class="search-person-row__name">' + escapeHtml(m.username) + '</p>' +
            (m.bio ? '<p class="search-person-row__meta">' + escapeHtml(m.bio) + '</p>' : '') +
        '</div>' +
    '</a>';
}

// Render list card — uses global renderListCard from list-card.js (loaded in base.html)
function renderSearchListCard(l) {
    const covers = (l.cover_urls || []).slice(0, 5);
    const placeholders = 5 - covers.length;

    const coverHtml = [
        ...covers.map(u => `<div class="list-card__cover-wrap"><img src="${escapeHtml(u)}" alt="" loading="lazy" class="list-card__cover-img"></div>`),
        ...Array(placeholders).fill('<div class="list-card__cover-wrap"><div class="list-card__cover-placeholder"></div></div>'),
    ].join('');

    const filmPart = l.film_count ? `<span class="list-card__dot">·</span> ${l.film_count} films` : '';
    const likesPart = l.likes_count ? `<span class="list-card__dot">·</span> ♥ ${l.likes_count}` : '';
    const descHtml = l.description ? `<p class="list-card__desc">${escapeHtml(l.description)}</p>` : '';

    return `
        <a href="/list/${l.id}" class="list-card list-card--row">
            <div class="list-card__covers">${coverHtml}</div>
            <div class="list-card__body">
                <p class="list-card__title">${escapeHtml(l.name)}</p>
                <p class="list-card__author">by ${escapeHtml(l.author_username)} ${filmPart} ${likesPart}</p>
                ${descHtml}
            </div>
        </a>
    `.trim();
}

// Route mixed result to appropriate renderer (film or person)
function renderMixedItem(item) {
    if (item.type === 'film' && item.film) return renderFilmRow(item.film);
    if (item.type === 'person' && item.person) return renderPersonRow(item.person);
    return '';
}

// Load initial mixed search results (All tab)
async function loadMixed() {
    try {
        const items = await fetchMixed(1);
        mixedLoaded = items.length;
        if (!items.length) {
            mixedGrid.innerHTML = '<p class="search-empty">No results found.</p>';
            return;
        }
        mixedGrid.innerHTML = '<div class="search-mixed-list">' + items.map(renderMixedItem).join('') + '</div>';
        mixedCount.textContent = mixedLoaded + ' shown';
        mixedMoreBtn.style.display = items.length === MIXED_PER_PAGE ? 'block' : 'none';
    } catch {
        mixedGrid.innerHTML = '<p class="search-empty">Failed to load results.</p>';
    }
}

// Load first page of films (lazy-loaded when tab is opened)
async function loadInitialFilms() {
    try {
        const films = await fetchFilms(1);
        filmsLoaded = films.length;
        if (!films.length) { filmsGrid.innerHTML = '<p class="search-empty">No films found.</p>'; return; }
        filmsGrid.innerHTML = '<div class="search-film-list">' + films.map(renderFilmRow).join('') + '</div>';
        filmsCount.textContent = filmsLoaded + ' shown';
        filmsMoreBtn.style.display = films.length === FILMS_PER_PAGE ? 'block' : 'none';
    } catch {
        filmsGrid.innerHTML = '<p class="search-empty">Failed to load films.</p>';
    }
}

// Load first page of persons (lazy-loaded when tab is opened)
async function loadInitialPersons() {
    try {
        const persons = await fetchPersons(1);
        personsLoaded = persons.length;
        if (!persons.length) { personsGrid.innerHTML = '<p class="search-empty">No people found.</p>'; return; }
        personsGrid.innerHTML = '<div class="search-person-list">' + persons.map(renderPersonRow).join('') + '</div>';
        personsCount.textContent = personsLoaded + ' shown';
        personsMoreBtn.style.display = persons.length === PERSONS_PER_PAGE ? 'block' : 'none';
    } catch {
        personsGrid.innerHTML = '<p class="search-empty">Failed to load people.</p>';
    }
}

// Load first page of members (lazy-loaded when tab is opened)
async function loadInitialMembers() {
    try {
        const members = await fetchMembers(1);
        membersLoaded = members.length;
        if (!members.length) { membersGrid.innerHTML = '<p class="search-empty">No members found.</p>'; return; }
        membersGrid.innerHTML = '<div class="search-person-list">' + members.map(renderMemberRow).join('') + '</div>';
        membersCount.textContent = membersLoaded + ' shown';
        membersMoreBtn.style.display = members.length === MEMBERS_PER_PAGE ? 'block' : 'none';
    } catch {
        membersGrid.innerHTML = '<p class="search-empty">Failed to load members.</p>';
    }
}

// Load first page of lists (lazy-loaded when tab is opened)
async function loadInitialLists() {
    try {
        const lists = await fetchLists(1);
        listsLoaded = lists.length;
        if (!lists.length) { listsGrid.innerHTML = '<p class="search-empty">No lists found.</p>'; return; }
        listsGrid.innerHTML = '<div class="search-list-grid">' + lists.map(renderSearchListCard).join('<div class="search-list-separator"></div>') + '</div>';
        listsCount.textContent = listsLoaded + ' shown';
        listsMoreBtn.style.display = lists.length === LISTS_PER_PAGE ? 'block' : 'none';
    } catch {
        listsGrid.innerHTML = '<p class="search-empty">Failed to load lists.</p>';
    }
}

// Load next page of mixed results on button click
mixedMoreBtn.addEventListener('click', async function () {
    try {
        const items = await fetchMixed(mixedNextPage);
        if (!items.length) { mixedMoreBtn.style.display = 'none'; return; }
        mixedGrid.querySelector('.search-mixed-list').innerHTML += items.map(renderMixedItem).join('');
        mixedLoaded += items.length;
        mixedCount.textContent = mixedLoaded + ' shown';
        if (items.length < MIXED_PER_PAGE) mixedMoreBtn.style.display = 'none';
    } catch {}
});

// Load next page of films
filmsMoreBtn.addEventListener('click', async function () {
    filmsPage++;
    try {
        const films = await fetchFilms(filmsPage);
        if (!films.length) { filmsMoreBtn.style.display = 'none'; return; }
        filmsGrid.querySelector('.search-film-list').innerHTML += films.map(renderFilmRow).join('');
        filmsLoaded += films.length;
        filmsCount.textContent = filmsLoaded + ' shown';
        if (films.length < FILMS_PER_PAGE) filmsMoreBtn.style.display = 'none';
    } catch {}
});

// Load next page of persons
personsMoreBtn.addEventListener('click', async function () {
    personsPage++;
    try {
        const persons = await fetchPersons(personsPage);
        if (!persons.length) { personsMoreBtn.style.display = 'none'; return; }
        personsGrid.querySelector('.search-person-list').innerHTML += persons.map(renderPersonRow).join('');
        personsLoaded += persons.length;
        personsCount.textContent = personsLoaded + ' shown';
        if (persons.length < PERSONS_PER_PAGE) personsMoreBtn.style.display = 'none';
    } catch {}
});

// Load next page of members
membersMoreBtn.addEventListener('click', async function () {
    membersPage++;
    try {
        const members = await fetchMembers(membersPage);
        if (!members.length) { membersMoreBtn.style.display = 'none'; return; }
        membersGrid.querySelector('.search-person-list').innerHTML += members.map(renderMemberRow).join('');
        membersLoaded += members.length;
        membersCount.textContent = membersLoaded + ' shown';
        if (members.length < MEMBERS_PER_PAGE) membersMoreBtn.style.display = 'none';
    } catch {}
});

// Load next page of lists
listsMoreBtn.addEventListener('click', async function () {
    listsPage++;
    try {
        const lists = await fetchLists(listsPage);
        if (!lists.length) { listsMoreBtn.style.display = 'none'; return; }
        listsGrid.querySelector('.search-list-grid').innerHTML += '<div class="search-list-separator"></div>' + lists.map(renderSearchListCard).join('<div class="search-list-separator"></div>');
        listsLoaded += lists.length;
        listsCount.textContent = listsLoaded + ' shown';
        if (lists.length < LISTS_PER_PAGE) listsMoreBtn.style.display = 'none';
    } catch {}
});

// Initialize search category tabs (All / Films / People / Members / Lists)
function initTabs() {
    const tabs = document.querySelectorAll('.search-sidebar__item');

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const val = tab.dataset.tab;

            allSection.style.display     = val === 'all'     ? 'block' : 'none';
            filmsSection.style.display   = val === 'films'   ? 'block' : 'none';
            peopleSection.style.display  = val === 'people'  ? 'block' : 'none';
            membersSection.style.display = val === 'members' ? 'block' : 'none';
            listsSection.style.display   = val === 'lists'   ? 'block' : 'none';

            // Lazy-load data only when tab is opened first time
            if (val === 'films'   && filmsLoaded === 0)   loadInitialFilms();
            if (val === 'people'  && personsLoaded === 0)  loadInitialPersons();
            if (val === 'members' && membersLoaded === 0)  loadInitialMembers();
            if (val === 'lists'   && listsLoaded === 0)    loadInitialLists();
        });
    });
}

// Escape HTML to prevent XSS injection in rendered content
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (SEARCH_QUERY) {
    loadMixed();
    initTabs();
}