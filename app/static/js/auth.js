// Initializes authentication state and updates navbar UI
async function initAuth() {
    const authBlock = document.getElementById('authBlock');
    if (!authBlock) return;

    try {
        const res = await fetch('/api/auth/me');

        if (res.ok) {
            const user = await res.json();
            renderLoggedIn(authBlock, user);
        } else if (res.status === 401) {
            const refreshed = await tryRefresh();
            if (refreshed) {
                const retryRes = await fetch('/api/auth/me');
                if (retryRes.ok) {
                    const user = await retryRes.json();
                    renderLoggedIn(authBlock, user);
                    return;
                }
            }
            renderLoggedOut(authBlock);
        } else {
            renderLoggedOut(authBlock);
        }
    } catch {
        renderLoggedOut(authBlock);
    }
}

// Attempts to refresh authentication token
async function tryRefresh() {
    try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        return res.ok;
    } catch {
        return false;
    }
}

// Renders navbar UI for authenticated user
function renderLoggedIn(authBlock, user) {
    // Build avatar URL if user has uploaded avatar
    const avatarUrl = user.avatar_path
        ? `/static/uploads/avatars/${user.avatar_path}`
        : null;

    const avatarHtml = avatarUrl
        ? `<img class="user-menu__avatar-img" src="${avatarUrl}" alt="${user.username}">`
        : `<span class="user-menu__avatar-letter">${user.username[0].toUpperCase()}</span>`;

    // Inject authenticated navbar UI
    authBlock.innerHTML = `
        <div class="user-menu">
            <div class="user-menu__trigger">
                <div class="user-menu__avatar">${avatarHtml}</div>
                <span class="user-menu__name">${user.username}</span>
                <span class="user-menu__arrow">▾</span>
            </div>
            <div class="user-menu__dropdown">
                <a href="/users/${user.username}" class="nav-dropdown__item">
                    <span class="nav-dropdown__item-icon">◉</span> My Profile
                </a>
                <a href="/collection" class="nav-dropdown__item">
                    <span class="nav-dropdown__item-icon">◈</span> Collection
                </a>
                <a href="/profile/edit" class="nav-dropdown__item">
                    <span class="nav-dropdown__item-icon">✦</span> Edit Profile
                </a>
                <div class="nav-dropdown__divider"></div>
                <button class="nav-dropdown__item nav-dropdown__item--danger" id="logoutBtn">
                    <span class="nav-dropdown__item-icon">→</span> Log out
                </button>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

// Renders navbar UI for guest (unauthenticated user)
function renderLoggedOut(authBlock) {
    authBlock.innerHTML = `
        <a href="/login" class="btn btn--outline">Login</a>
        <a href="/register" class="btn btn--primary">Register</a>
    `;
}

// Logs out current user and redirects to home page
async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

initAuth();