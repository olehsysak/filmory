// Mobile navbar burger menu
(function () {
    const burger  = document.getElementById('navbarBurger');
    const drawer  = document.getElementById('navbarDrawer');

    if (!burger || !drawer) return;

    // Toggle drawer open/close
    burger.addEventListener('click', function () {
        const isOpen = drawer.classList.toggle('is-open');
        burger.classList.toggle('is-open', isOpen);
        burger.setAttribute('aria-expanded', isOpen);
        drawer.setAttribute('aria-hidden', !isOpen);
        // Prevent body scroll when drawer is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close drawer when a link inside it is clicked
    drawer.addEventListener('click', function (e) {
        if (e.target.closest('a')) {
            closeDrawer();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeDrawer();
    });

    function closeDrawer() {
        drawer.classList.remove('is-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // Drawer search — redirect to /search on Enter or submit
    const drawerInput = document.getElementById('drawerSearchInput');
    if (drawerInput) {
        drawerInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const q = drawerInput.value.trim();
                if (q) window.location.href = '/search?q=' + encodeURIComponent(q);
            }
        });
    }

    // Sync auth state into drawer after auth.js renders the navbar authBlock.
    // We watch the authBlock and mirror it into drawerAuthBlock.
    const authBlock   = document.getElementById('authBlock');
    const drawerAuth  = document.getElementById('drawerAuthBlock');

    if (authBlock && drawerAuth) {
        const observer = new MutationObserver(function () {
            syncDrawerAuth(authBlock, drawerAuth);
        });
        observer.observe(authBlock, { childList: true, subtree: true });
        // Run once in case auth.js already finished
        syncDrawerAuth(authBlock, drawerAuth);
    }

    function syncDrawerAuth(source, target) {
        // If logged in — show profile link + logout button
        const userTrigger = source.querySelector('.user-menu__trigger');
        const logoutBtn   = source.querySelector('#logoutBtn');
        const profileLink = source.querySelector('a[href^="/users/"]');

        if (userTrigger) {
            // Logged in state
            const username    = source.querySelector('.user-menu__name')?.textContent || '';
            const profileHref = profileLink?.getAttribute('href') || '#';

            target.innerHTML = `
                <a href="${profileHref}" class="drawer__link">My Profile</a>
                <a href="/collection" class="drawer__link">Collection</a>
                <a href="/profile/edit" class="drawer__link">Edit Profile</a>
                <button class="drawer__link" id="drawerLogoutBtn" style="background:none;border:none;font-family:inherit;font-size:15px;font-weight:500;text-align:left;cursor:pointer;color:#e53e3e;">Log out</button>
            `;
            document.getElementById('drawerLogoutBtn')?.addEventListener('click', async function () {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
            });
        } else {
            // Guest state
            target.innerHTML = `
                <a href="/login"    class="drawer__link">Login</a>
                <a href="/register" class="drawer__link">Register</a>
            `;
        }
    }
})();