// Add to List modal — manages list selection, creation, and film membership sync
(function () {

    // TMDB film ID extracted from page contex
    const tmdbId = document.getElementById('filmActions')?.dataset.tmdbId;

    let modalEl = null;
    let currentLists = [];
    let pendingChanges = {};
    let activeFilter = 'all';

    // Initializes modal trigger and bindings
    function initAddToList() {
        const btn = document.getElementById('addToListBtn');
        if (!btn || !tmdbId) return;

        createModal();

        // Disable for guest users
        const actions = document.getElementById('filmActions');
        if (actions?.classList.contains('film-actions--guest')) return;

        btn.addEventListener('click', openModal);
    }

    // Builds modal HTML structure and attaches event listeners
    function createModal() {
        modalEl = document.createElement('div');
        modalEl.className = 'atl-overlay';
        modalEl.innerHTML = `
            <div class="atl-modal">
                <div class="atl-modal__header">
                    <span class="atl-modal__title">Add to list</span>

                    <div class="atl-modal__filters">
                        <button class="atl-filter-btn atl-filter-btn--active" data-filter="all">All</button>
                        <button class="atl-filter-btn" data-filter="private">Private</button>
                        <button class="atl-filter-btn" data-filter="public">Public</button>
                    </div>

                    <button class="atl-modal__close" id="atlClose">✕</button>
                </div>

                <div class="atl-modal__body" id="atlBody">
                    <div class="atl-loading">Loading…</div>
                </div>

                <div class="atl-modal__footer">
                    <button class="atl-btn atl-btn--ghost" id="atlNewBtn">+ New list</button>
                    <button class="atl-btn atl-btn--primary" id="atlSaveBtn">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Close on overlay click
        modalEl.addEventListener('click', e => {
            if (e.target === modalEl) closeModal();
        });

        document.getElementById('atlClose').addEventListener('click', closeModal);
        document.getElementById('atlSaveBtn').addEventListener('click', saveChanges);
        document.getElementById('atlNewBtn').addEventListener('click', showCreateForm);

        // Filter buttons logic
        modalEl.querySelectorAll('.atl-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modalEl.querySelectorAll('.atl-filter-btn')
                    .forEach(b => b.classList.remove('atl-filter-btn--active'));
                btn.classList.add('atl-filter-btn--active');
                activeFilter = btn.dataset.filter;
                renderLists();
            });
        });
    }

    // Opens modal and loads membership state
    async function openModal() {
        pendingChanges = {};
        modalEl.classList.add('atl-overlay--visible');
        document.body.style.overflow = 'hidden';
        await loadMembership();
    }

    // Closes modal and resets UI state
    function closeModal() {
        modalEl.classList.remove('atl-overlay--visible');
        document.body.style.overflow = '';
        activeFilter = 'all';

        // Reset filter UI
        modalEl.querySelectorAll('.atl-filter-btn')
            .forEach(b => b.classList.remove('atl-filter-btn--active'));

        modalEl.querySelector('[data-filter="all"]')
            .classList.add('atl-filter-btn--active');

        hideCreateForm();
    }

    // Loads user list membership for this film
    async function loadMembership() {
        const body = document.getElementById('atlBody');
        body.innerHTML = '<div class="atl-loading">Loading…</div>';

        try {
            const res = await fetch(`/api/user/lists/membership/${tmdbId}`);
            if (!res.ok) throw new Error();

            const data = await res.json();
            currentLists = data.lists;

            renderLists();
        } catch {
            body.innerHTML = '<div class="atl-empty">Failed to load lists.</div>';
        }
    }

    // Renders filtered list view
    function renderLists() {
        const body = document.getElementById('atlBody');

        const filtered = currentLists.filter(list => {
            if (activeFilter === 'private') return !list.is_public;
            if (activeFilter === 'public') return list.is_public;
            return true;
        });

        if (!filtered.length) {
            body.innerHTML = '<div class="atl-empty">No lists match this filter.</div>';
            return;
        }

        // Render each list row
        body.innerHTML = filtered.map(list => {

            const checked = list.id in pendingChanges
                ? pendingChanges[list.id]
                : list.has_film;

            const badge = list.is_public
                ? '<span class="atl-badge atl-badge--public">Public</span>'
                : '<span class="atl-badge atl-badge--private">Private</span>';

            return `
                <label class="atl-list-item" data-id="${list.id}">
                    <div class="atl-list-item__poster">
                        ${list.cover_url
                            ? `<img src="${list.cover_url}" alt="">`
                            : '<div class="atl-list-item__poster-placeholder"></div>'
                        }
                    </div>
                    <div class="atl-list-item__info">
                        <span class="atl-list-item__name">${escapeHtml(list.name)}</span>
                        <span class="atl-list-item__meta">${list.film_count} films ${badge}</span>
                    </div>
                    <input class="atl-checkbox" type="checkbox" data-id="${list.id}"
                        ${checked ? 'checked' : ''}>
                </label>
            `;
        }).join('');

        body.querySelectorAll('.atl-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = parseInt(cb.dataset.id);
                const original = currentLists.find(l => l.id === id)?.has_film ?? false;

                if (cb.checked === original) {
                    delete pendingChanges[id];
                } else {
                    pendingChanges[id] = cb.checked;
                }
            });
        });
    }

    // Sends add/remove requests for changed lists
    async function saveChanges() {
        const entries = Object.entries(pendingChanges);
        if (!entries.length) { closeModal(); return; }

        const saveBtn = document.getElementById('atlSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
            await Promise.all(entries.map(([listId, shouldAdd]) => {
                const url = `/api/user/lists/${listId}/films/${tmdbId}`;
                return fetch(url, { method: shouldAdd ? 'POST' : 'DELETE' });
            }));
            closeModal();
        } catch {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
            showError(saveBtn);
        }
    }

    // Shows temporary error message near Save button
    function showError(btn) {
        const msg = document.createElement('span');
        msg.className = 'atl-error';
        msg.textContent = 'Something went wrong. Try again.';
        btn.parentElement.prepend(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    // Shows "create new list" form
    function showCreateForm() {
        const newBtn = document.getElementById('atlNewBtn');
        if (document.getElementById('atlCreateForm')) return;

        newBtn.style.display = 'none';
        document.getElementById('atlSaveBtn').style.display = 'none';

        const form = document.createElement('div');
        form.className = 'atl-create-form';
        form.id = 'atlCreateForm';
        form.innerHTML = `
            <input class="atl-input" id="atlNewName" type="text" placeholder="List name" maxlength="50" autofocus>
            <div class="atl-char-counter" id="atlNameCounter">0 / 50</div>
            <textarea class="atl-input atl-textarea" id="atlNewDesc" placeholder="Description (optional)" maxlength="475" rows="2"></textarea>
            <div class="atl-char-counter" id="atlDescCounter">0 / 475</div>
            <div class="atl-create-form__actions">
                <label class="atl-toggle-row">
                    <span>Public</span>
                    <div class="atl-toggle" id="atlPublicToggle" data-on="false">
                        <div class="atl-toggle__knob"></div>
                    </div>
                </label>
                <div class="atl-create-form__btns">
                    <button class="atl-btn atl-btn--ghost" id="atlCancelCreate">Cancel</button>
                    <button class="atl-btn atl-btn--primary" id="atlConfirmCreate">Create</button>
                </div>
            </div>
        `;

        document.getElementById('atlBody').after(form);

        document.getElementById('atlCancelCreate').addEventListener('click', hideCreateForm);
        document.getElementById('atlConfirmCreate').addEventListener('click', submitCreate);

        const toggle = document.getElementById('atlPublicToggle');
        toggle.addEventListener('click', () => {
            const isOn = toggle.dataset.on === 'true';
            toggle.dataset.on = !isOn;
        });

        // Char counters
        document.getElementById('atlNewName').addEventListener('input', function () {
            document.getElementById('atlNameCounter').textContent = `${this.value.length} / 50`;
        });
        document.getElementById('atlNewDesc').addEventListener('input', function () {
            document.getElementById('atlDescCounter').textContent = `${this.value.length} / 475`;
        });
    }

    // Hides create form and restores UI
    function hideCreateForm() {
        document.getElementById('atlCreateForm')?.remove();
        const newBtn = document.getElementById('atlNewBtn');
        if (newBtn) newBtn.style.display = '';
        const saveBtn = document.getElementById('atlSaveBtn');
        if (saveBtn) saveBtn.style.display = '';
    }

    // Submits new list and optionally adds current film to it
    async function submitCreate() {
        const name = document.getElementById('atlNewName')?.value.trim();
        const description = document.getElementById('atlNewDesc')?.value.trim() || null;
        if (!name) {
            document.getElementById('atlNewName')?.focus();
            return;
        }

        const isPublic = document.getElementById('atlPublicToggle')?.dataset.on === 'true';
        const confirmBtn = document.getElementById('atlConfirmCreate');
        confirmBtn.disabled = true;

        try {
            const res = await fetch('/api/user/lists/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, is_public: isPublic }),
            });
            if (!res.ok) throw new Error();

            const newList = await res.json();

            await fetch(`/api/user/lists/${newList.id}/films/${tmdbId}`, {
                method: 'POST',
            });

            hideCreateForm();
            await loadMembership();

        } catch {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Error. Retry?';
        }
    }

    // Basic HTML escaping for safe rendering
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Expose initializer to global scope
    window.initAddToList = initAddToList;

})();