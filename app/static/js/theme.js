// theme switching
const html = document.documentElement;
const toggle = document.getElementById('themeToggle');
const icon = toggle?.querySelector('.theme-toggle__icon');

const saved = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', saved);
updateIcon(saved);

toggle?.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon(next);
});

function updateIcon(theme) {
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
}