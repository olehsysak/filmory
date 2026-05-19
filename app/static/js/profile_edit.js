'use strict';

// State
let selectedFilmIds = new Set(CURRENT_USER.pinned_film_ids || []);
let selectedListIds = new Set(CURRENT_USER.pinned_list_ids || []);

let allFavorites = [];
let allLists = [];

let tempFilmIds = new Set();
let tempListIds = new Set();

// Switch between settings tabs
document.querySelectorAll('.pe-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.pe-tab').forEach(t => t.classList.remove('pe-tab--active'));
        document.querySelectorAll('.pe-panel').forEach(p => p.classList.add('pe-panel--hidden'));
        tab.classList.add('pe-tab--active');
        document.getElementById(`panel-${tab.dataset.tab}`).classList.remove('pe-panel--hidden');
        if (tab.dataset.tab === 'pinned') initPinnedTab();
    });
});

// Auto-switch to tab from URL param
const urlTab = new URLSearchParams(window.location.search).get('tab');

if (urlTab) {
    const tab = document.querySelector(`.pe-tab[data-tab="${urlTab}"]`);
    if (tab) tab.click();
}

// Bio counter
const bioEl = document.getElementById('peBio');
const bioCount = document.getElementById('peBioCount');

if (bioEl && bioCount) {
    bioEl.addEventListener('input', () => { bioCount.textContent = bioEl.value.length; });
}

// Avatar upload
document.getElementById('peAvatarInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
        if (!res.ok) {
            const err = await res.json();
            showMsg('peBasicMsg', err.detail || 'Upload failed', 'error');
            return;
        }
        const data = await res.json();
        document.getElementById('peAvatarPreview').innerHTML =
            `<img src="${data.avatar_url}?t=${Date.now()}" alt="avatar">`;

        showMsg('peBasicMsg', 'Photo updated', 'success');

    } catch { showMsg('peBasicMsg', 'Upload failed. Try again.', 'error'); }
});

// Save basic
document.getElementById('peSaveBasic').addEventListener('click', async () => {
    const btn = document.getElementById('peSaveBasic');
    const username = document.getElementById('peUsername').value.trim();
    const bio = document.getElementById('peBio').value.trim();

    if (!username) { showMsg('peBasicMsg', 'Username cannot be empty', 'error'); return; }

    // Button loading state
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        const res = await fetch('/api/profile/basic', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, bio: bio || null }),
        });

        if (!res.ok) { const err = await res.json(); showMsg('peBasicMsg', err.detail || 'Failed', 'error'); return; }
        showMsg('peBasicMsg', 'Saved successfully', 'success');

        // Update "Back to profile" link
        document.querySelector('.pe-back').href = `/users/${username}`;

    } catch { showMsg('peBasicMsg', 'Something went wrong', 'error'); }

    finally { btn.disabled = false; btn.textContent = 'Save changes'; }
});

// Save password
document.getElementById('peSaveSecurity').addEventListener('click', async () => {

    const btn = document.getElementById('peSaveSecurity');
    const current = document.getElementById('peCurrentPwd').value;
    const newPwd  = document.getElementById('peNewPwd').value;
    const confirm = document.getElementById('peConfirmPwd').value;

    if (!current || !newPwd || !confirm) { showMsg('peSecurityMsg', 'Fill in all fields', 'error'); return; }
    if (newPwd !== confirm) { showMsg('peSecurityMsg', 'Passwords do not match', 'error'); return; }
    if (newPwd.length < 8) { showMsg('peSecurityMsg', 'Minimum 8 characters', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Updating...';

    try {
        const res = await fetch('/api/profile/password', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: current, new_password: newPwd }),
        });

        if (!res.ok) { const err = await res.json(); showMsg('peSecurityMsg', err.detail || 'Failed', 'error'); return; }
        showMsg('peSecurityMsg', 'Password updated', 'success');

        ['peCurrentPwd', 'peNewPwd', 'peConfirmPwd'].forEach(id => document.getElementById(id).value = '');

    } catch { showMsg('peSecurityMsg', 'Something went wrong', 'error'); }

    finally { btn.disabled = false; btn.textContent = 'Update password'; }
});

// Save privacy
document.getElementById('peSavePrivacy').addEventListener('click', async () => {

    const btn = document.getElementById('peSavePrivacy');
    btn.disabled = true; btn.textContent = 'Saving...';

    // Send updated privacy visibility settings to the server
    try {
        const res = await fetch('/api/profile/privacy', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                want_to_watch_public: document.getElementById('toggleWantToWatch').checked,
                watching_public:      document.getElementById('toggleWatching').checked,
                completed_public:     document.getElementById('toggleCompleted').checked,
                dropped_public:       document.getElementById('toggleDropped').checked,
                favorites_public:     document.getElementById('toggleFavorites').checked,
                lists_public:         document.getElementById('toggleLists').checked,
                activity_public:      document.getElementById('toggleActivity').checked,
            }),
        });

        if (!res.ok) { showMsg('pePrivacyMsg', 'Failed to save', 'error'); return; }
        showMsg('pePrivacyMsg', 'Privacy settings saved', 'success');

    } catch { showMsg('pePrivacyMsg', 'Something went wrong', 'error'); }

    finally { btn.disabled = false; btn.textContent = 'Save privacy settings'; }
});

// Save pinned
document.getElementById('peSavePinned').addEventListener('click', async () => {

    const btn = document.getElementById('peSavePinned');
    btn.disabled = true; btn.textContent = 'Saving...';

    // Send updated pinned films and lists to the server and show result message
    try {
        const res = await fetch('/api/profile/pinned', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pinned_film_ids: [...selectedFilmIds],
                pinned_list_ids: [...selectedListIds],
            }),
        });

        if (!res.ok) { showMsg('pePinnedMsg', 'Failed to save', 'error'); return; }
        showMsg('pePinnedMsg', 'Pinned items saved', 'success');

    } catch { showMsg('pePinnedMsg', 'Something went wrong', 'error'); }

    finally { btn.disabled = false; btn.textContent = 'Save pinned'; }
});

// Pinned tab init
async function initPinnedTab() {

    if (allFavorites.length === 0) await loadFavorites();
    if (allLists.length === 0) await loadLists();

    renderFilmsPreview();
    renderListsPreview();
}

// Load favorites films
async function loadFavorites() {
    try {
        const res = await fetch('/api/user/favorites/');
        if (!res.ok) return;
        const data = await res.json();
        allFavorites = data.map(entry => entry.film || entry);
    } catch { allFavorites = []; }
}

// Load user lists
async function loadLists() {
    try {
        const res = await fetch('/api/user/lists/');
        if (!res.ok) return;
        const data = await res.json();
        allLists = data.filter(l => l.is_public);
    } catch { allLists = []; }
}

// Films preview
function renderFilmsPreview() {
    const container = document.getElementById('pePinnedFilmsPreview');
    const badge = document.getElementById('pePinnedFilmsCount');

    // Update counter
    badge.textContent = `${selectedFilmIds.size} / ${FILMS_MAX}`;

    const selectedArr = [...selectedFilmIds];
    const slots = [];

    // Always render fixed amount of slots
    for (let i = 0; i < FILMS_MAX; i++) {

        const filmId = selectedArr[i];
        const film = filmId ? allFavorites.find(f => f.id === filmId) : null;

        // Filled slot
        if (film) {
            slots.push(`
                <div class="pe-prev-film" data-film-id="${film.id}">
                    ${film.poster_url
                        ? `<img class="pe-prev-film__poster" src="${film.poster_url}" alt="${escHtml(film.title)}" loading="lazy">`
                        : `<div class="pe-prev-film__poster pe-prev-film__poster--empty">No poster</div>`
                    }
                    <button class="pe-prev-film__remove" data-remove-film="${film.id}" title="Remove">×</button>
                </div>
            `);
        } else {
            // Empty slot
            slots.push(`
                <div class="pe-prev-film">
                    <div class="pe-prev-film__poster--empty">+</div>
                </div>
            `);
        }
    }

    container.innerHTML = slots.join('');
    // Remove handlers
    container.querySelectorAll('[data-remove-film]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedFilmIds.delete(parseInt(btn.dataset.removeFilm));
            renderFilmsPreview();
        });
    });
}

// Lists preview
function renderListsPreview() {
    const container = document.getElementById('pePinnedListsPreview');
    const badge = document.getElementById('pePinnedListsCount');

    // Update counter (selected / max allowed)
    badge.textContent = `${selectedListIds.size} / ${LISTS_MAX}`;

    const rows = [];

    // Build preview rows for each selected list
    for (const listId of selectedListIds) {
        const lst = allLists.find(l => l.id === listId);
        if (!lst) continue;

        // List cover fallback
        const cover = lst.cover_url
            ? `<img src="${lst.cover_url}" alt="${escHtml(lst.name)}">`
            : '☰';

        rows.push(`
            <div class="pe-prev-list">
                <div class="pe-prev-list__cover">${cover}</div>
                <span class="pe-prev-list__name">${escHtml(lst.name)}</span>
                <button class="pe-prev-list__remove" data-remove-list="${lst.id}" title="Remove">×</button>
            </div>
        `);
    }

    // Empty state
    if (rows.length === 0) {
        rows.push(`<p style="font-size:13px;color:var(--text-muted);padding:4px 0">No lists selected yet.</p>`);
    }

    container.innerHTML = rows.join('');

    // Attach remove handlers for each list
    container.querySelectorAll('[data-remove-list]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedListIds.delete(parseInt(btn.dataset.removeList));
            renderListsPreview();
        });
    });
}

// Open / close handlers for films selection modal
document.getElementById('peOpenFilmsModal').addEventListener('click', openFilmsModal);
document.getElementById('peFilmsModalClose').addEventListener('click', closeFilmsModal);
document.getElementById('peFilmsModalCancel').addEventListener('click', closeFilmsModal);

// Close modal when clicking outside content
document.getElementById('peFilmsModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeFilmsModal();
});

// Save selected films from temp state → permanent state
document.getElementById('peFilmsModalSave').addEventListener('click', () => {
    selectedFilmIds = new Set(tempFilmIds);
    renderFilmsPreview();
    closeFilmsModal();
});

// Search inside films modal
document.getElementById('peFilmsSearch').addEventListener('input', e => {
    renderFilmsGrid(e.target.value.toLowerCase());
});

// Open films modal and initialize temp selection state
function openFilmsModal() {
    tempFilmIds = new Set(selectedFilmIds);
    document.getElementById('peFilmsModalOverlay').style.display = 'flex';
    document.getElementById('peFilmsSearch').value = '';
    renderFilmsGrid('');
    updateFilmsCounter();
}

// Close films modal
function closeFilmsModal() {
    document.getElementById('peFilmsModalOverlay').style.display = 'none';
}

// Render films grid inside modal (filtered by search query)
function renderFilmsGrid(query = '') {
    const grid = document.getElementById('peFilmsGrid');
    const filtered = allFavorites.filter(f => !query || f.title.toLowerCase().includes(query));

    if (!filtered.length) { grid.innerHTML = '<p class="pe-modal__loading">No results.</p>'; return; }

    grid.innerHTML = filtered.map(film => {
        const selected = tempFilmIds.has(film.id);
        return `
            <div class="pe-modal-film ${selected ? 'pe-modal-film--selected' : ''}"
                 data-modal-film-id="${film.id}">
                ${film.poster_url
                    ? `<img class="pe-modal-film__poster" src="${film.poster_url}" alt="${escHtml(film.title)}" loading="lazy">`
                    : `<div class="pe-modal-film__poster pe-modal-film__poster--empty">No poster</div>`
                }
                <div class="pe-modal-film__check">✓</div>
                <p class="pe-modal-film__title">${escHtml(film.title)}</p>
            </div>
        `;
    }).join('');

    // Attach click handlers for selecting films
    grid.querySelectorAll('[data-modal-film-id]').forEach(el => {
        el.addEventListener('click', () => toggleModalFilm(el));
    });
}

// Toggle film selection inside modal
function toggleModalFilm(el) {
    const id = parseInt(el.dataset.modalFilmId);

    if (tempFilmIds.has(id)) {
        tempFilmIds.delete(id);
        el.classList.remove('pe-modal-film--selected');
    } else {
        if (tempFilmIds.size >= FILMS_MAX) {
            showMsg('pePinnedMsg', `Maximum ${FILMS_MAX} films allowed`, 'error');
            return;
        }
        tempFilmIds.add(id);
        el.classList.add('pe-modal-film--selected');
    }

    updateFilmsCounter();
}

// Update films counter in modal UI
function updateFilmsCounter() {
    document.getElementById('peFilmsCounter').innerHTML =
        `Selected: <strong>${tempFilmIds.size}</strong> / ${FILMS_MAX}`;
}

// Open / close handlers for lists selection modal
document.getElementById('peOpenListsModal').addEventListener('click', openListsModal);
document.getElementById('peListsModalClose').addEventListener('click', closeListsModal);
document.getElementById('peListsModalCancel').addEventListener('click', closeListsModal);

// Close modal on overlay click
document.getElementById('peListsModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeListsModal();
});

// Save selected lists
document.getElementById('peListsModalSave').addEventListener('click', () => {
    selectedListIds = new Set(tempListIds);
    renderListsPreview();
    closeListsModal();
});

// Search inside lists modal
document.getElementById('peListsSearch').addEventListener('input', e => {
    renderListsGrid(e.target.value.toLowerCase());
});

// Open lists modal and init temp state
function openListsModal() {
    tempListIds = new Set(selectedListIds);
    document.getElementById('peListsModalOverlay').style.display = 'flex';
    document.getElementById('peListsSearch').value = '';
    renderListsGrid('');
    updateListsCounter();
}

// Close lists modal
function closeListsModal() {
    document.getElementById('peListsModalOverlay').style.display = 'none';
}

// Render lists inside modal
function renderListsGrid(query = '') {
    const grid = document.getElementById('peListsGrid');
    const filtered = allLists.filter(l => !query || l.name.toLowerCase().includes(query));

    if (!filtered.length) { grid.innerHTML = '<p class="pe-modal__loading">No results.</p>'; return; }

    grid.innerHTML = filtered.map(lst => {
        const selected = tempListIds.has(lst.id);
        const cover = lst.cover_url
            ? `<img src="${lst.cover_url}" alt="${escHtml(lst.name)}">`
            : '☰';
        return `
            <div class="pe-modal-list ${selected ? 'pe-modal-list--selected' : ''}"
                 data-modal-list-id="${lst.id}">
                <div class="pe-modal-list__cover">${cover}</div>
                <div class="pe-modal-list__info">
                    <p class="pe-modal-list__name">${escHtml(lst.name)}</p>
                    <p class="pe-modal-list__meta">${lst.film_count ?? ''} films</p>
                </div>
                <div class="pe-modal-list__check">${selected ? '✓' : ''}</div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('[data-modal-list-id]').forEach(el => {
        el.addEventListener('click', () => toggleModalList(el));
    });
}

// Toggle list selection inside modal
function toggleModalList(el) {
    const id = parseInt(el.dataset.modalListId);
    const check = el.querySelector('.pe-modal-list__check');

    if (tempListIds.has(id)) {
        tempListIds.delete(id);
        el.classList.remove('pe-modal-list--selected');
        check.textContent = '';
    } else {
        if (tempListIds.size >= LISTS_MAX) {
            showMsg('pePinnedMsg', `Maximum ${LISTS_MAX} lists allowed`, 'error');
            return;
        }

        tempListIds.add(id);
        el.classList.add('pe-modal-list--selected');
        check.textContent = '✓';
    }

    updateListsCounter();
}

// Update lists counter in modal UI
function updateListsCounter() {
    document.getElementById('peListsCounter').innerHTML =
        `Selected: <strong>${tempListIds.size}</strong> / ${LISTS_MAX}`;
}

// Helpers
// Show temporary UI message (success/error/info)
function showMsg(id, text, type) {
    const el = document.getElementById(id);

    if (!el) return;

    el.textContent = text;
    el.className = `pe-msg pe-msg--${type}`;

    setTimeout(() => { el.textContent = ''; el.className = 'pe-msg'; }, 4000);
}

// Escape HTML to prevent XSS in rendered templates
function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}