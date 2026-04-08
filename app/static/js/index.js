// Welcome banner
async function loadWelcome() {
    const banner = document.getElementById('welcomeBanner');
    if (!banner) return;

    banner.innerHTML = `
        <div class="welcome-banner--guest">
            <div class="welcome-banner__text">
                <h2>Discover your next favourite film</h2>
                <p>Track films you've watched, create lists and share with friends.</p>
            </div>
            <div style="display:flex;gap:10px;flex-shrink:0">
                <a href="/register" class="btn btn--primary">Get Started</a>
                <a href="/login" class="btn btn--outline">Login</a>
            </div>
        </div>
    `;
}

// Row scroll arrows
function initRowArrows() {
    document.querySelectorAll('.film-row__wrapper').forEach(wrapper => {
        const track = wrapper.querySelector('.film-row__track');
        const prev = wrapper.querySelector('.row-arrow--prev');
        const next = wrapper.querySelector('.row-arrow--next');

        const scrollBy = 340;

        prev?.addEventListener('click', () => {
            track.scrollBy({ left: -scrollBy, behavior: 'smooth' });
        });

        next?.addEventListener('click', () => {
            track.scrollBy({ left: scrollBy, behavior: 'smooth' });
        });
    });
}

loadWelcome();
initRowArrows();