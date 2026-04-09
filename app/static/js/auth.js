// Check auth state and update navbar
async function initAuth() {
    const authBlock = document.getElementById('authBlock');
    if (!authBlock) return;

    try {
        const res = await fetch('/api/auth/me');

        if (res.ok) {
            const user = await res.json();
            renderLoggedIn(authBlock, user);
        } else if (res.status === 401) {
            // Try refresh
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

async function tryRefresh() {
    try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        return res.ok;
    } catch {
        return false;
    }
}

function renderLoggedIn(authBlock, user) {
    authBlock.innerHTML = `
        <a href="/profile" class="btn btn--outline">${user.username}</a>
        <button class="btn btn--outline" id="logoutBtn">Logout</button>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

function renderLoggedOut(authBlock) {
    authBlock.innerHTML = `
        <a href="/login" class="btn btn--outline">Login</a>
        <a href="/register" class="btn btn--primary">Register</a>
    `;
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

initAuth();