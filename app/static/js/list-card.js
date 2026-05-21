'use strict';

// Renders reusable list card component.
function renderListCard(list, opts = {}) {
    const {
        showAuthor     = false,
        showBadge      = false,
        showDesc       = false,
        showViews      = false,
        showDate       = false,
        showFilmCount  = false,
        showLikes      = true,
        showNewBadge  = false,
        uniform        = false,
        compact        = false,
        row            = false,
    } = opts;

    // Compact layout uses 3 covers, default layout uses 5
    const slotCount = compact ? 3 : 5;

    // Limit available covers to slot count
    const urls = (list.cover_urls || []).slice(0, slotCount);

    // Fill missing slots with placeholders
    const placeholders = slotCount - urls.length;

    // Build covers grid HTML
    const coverHtml = [
        ...urls.map(u => `<div class="list-card__cover-wrap"><img src="${_lce(u)}" alt="" loading="lazy" class="list-card__cover-img"></div>`),
        ...Array(placeholders).fill('<div class="list-card__cover-wrap"><div class="list-card__cover-placeholder"></div></div>'),
    ].join('');

    // Secondary line (author or visibility badge)
    let secondLine = '';

    // Author line with optional film count
    if (showAuthor && list.author_username) {
        const filmPart = showFilmCount && list.film_count
            ? ` <span class="list-card__dot">·</span> ${list.film_count} films`
            : '';
        secondLine = `<p class="list-card__author">by ${_lce(list.author_username)}${filmPart}</p>`;

    // Public/private badge
    } else if (showBadge && list.is_public !== undefined) {
        const cls   = list.is_public ? 'public'  : 'private';
        const label = list.is_public ? 'Public'  : 'Private';
        secondLine = `<span class="list-card__badge list-card__badge--${cls}">${label}</span>`;
    }

    // Description
    const descHtml = showDesc && list.description
        ? `<p class="list-card__desc">${_lce(list.description)}</p>`
        : '';

    // Meta information
    const metaParts = list.film_count && !showFilmCount
        ? [`<span class="list-card__stat">${list.film_count} films</span>`]
        : [];

    if (showLikes && list.likes_count) {
        metaParts.push(
            '<span class="list-card__dot">·</span>',
            `<span class="list-card__stat">♥ ${list.likes_count}</span>`,
        );
    }

    if (showViews && list.views_count) {
        metaParts.push(
            '<span class="list-card__dot">·</span>',
            `<span class="list-card__stat">👁 ${list.views_count}</span>`,
        );
    }

    if (showDate && list.updated_at) {
        const date = new Date(list.updated_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        metaParts.push(
            '<span class="list-card__dot">·</span>',
            `<span class="list-card__stat">${date}</span>`,
        );
    }

    // CSS modifiers
    const classes = ['list-card'];
    if (showBadge)  classes.push('list-card--owned');
    if (uniform)    classes.push('list-card--uniform');
    if (compact)    classes.push('list-card--compact');
    if (row)        classes.push('list-card--row');

    return `
        <a href="/list/${list.id}" class="${classes.join(' ')}">
            <div class="list-card__covers">${coverHtml}</div>
            <div class="list-card__body">
                <div class="list-card__title-row">
                    <p class="list-card__title">${_lce(list.name)}</p>
                    ${showNewBadge ? '<span class="list-card__new-badge">New</span>' : ''}
                </div>
                ${secondLine}
                ${descHtml}
                <div class="list-card__meta">${metaParts.join('')}</div>
            </div>
        </a>
    `.trim();
}

// Renders skeleton loading cards into container.
function renderListSkeletons(container, count = 6) {
    container.innerHTML = Array(count).fill(`
        <div class="list-card list-card--skeleton">
            <div class="list-card__covers"></div>
            <div class="list-card__body">
                <div class="skeleton-box" style="height:13px;width:70%;border-radius:4px;"></div>
                <div class="skeleton-box" style="height:11px;width:40%;border-radius:4px;margin-top:5px;"></div>
            </div>
        </div>
    `).join('');
}

// Escapes HTML entities to prevent XSS.
function _lce(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}