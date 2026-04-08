// Animate backdrop zoom on load
const backdrop = document.querySelector('.film-hero__backdrop');
if (backdrop) {
    setTimeout(() => { backdrop.style.transform = 'scale(1)'; }, 100);
}

// Animate popularity bar on load
const bar = document.querySelector('.film-popularity__bar-fill');
if (bar) {
    const target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(() => { bar.style.width = target; }, 300);
}