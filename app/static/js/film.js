// Animate backdrop zoom on load
var backdrop = document.querySelector('.film-hero__backdrop');
if (backdrop) {
    setTimeout(function() { backdrop.style.transform = 'scale(1)'; }, 100);
}

// Animate popularity bar on load
var bar = document.querySelector('.film-popularity__bar-fill');
if (bar) {
    var target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(function() { bar.style.width = target; }, 300);
}

// Similar films row arrows
var similarWrapper = document.querySelector('.film-similar .film-row__wrapper');
if (similarWrapper) {
    var track = similarWrapper.querySelector('.film-row__track');
    var prev = similarWrapper.querySelector('.row-arrow--prev');
    var next = similarWrapper.querySelector('.row-arrow--next');
    var scrollBy = 340;

    if (prev) prev.addEventListener('click', function() {
        track.scrollBy({ left: -scrollBy, behavior: 'smooth' });
    });
    if (next) next.addEventListener('click', function() {
        track.scrollBy({ left: scrollBy, behavior: 'smooth' });
    });
}