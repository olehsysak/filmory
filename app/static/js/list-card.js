'use strict';

function renderListCard(list, opts = {}) {
    const {
        showAuthor = false,
        showBadge  = false,
        showDesc   = false,
        showViews  = false,
        showDate   = false,
        uniform    = false,
        compact    = false,
    } = opts;

    // ── Cover slots ──────────────────────────────────────────────
    // compact використовує 3 слоти, всі інші — 5
    const slotCount = compact ? 3 : 5;
    const urls = (list.cover_urls || []).slice(0, slotCount);
    const placeholders = slotCount - urls.length;

    const coverHtml = [
        ...urls.map(u => `<img src="${_lce(u)}" alt="" loading="lazy" class="list-card__cover-img">`),
        ...Array(placeholders).fill('<div class="list-card__cover-placeholder"></div>'),
    ].join('');

    // ── Другий рядок: автор або badge ───────────────────────────
    let secondLine = '';
    if (showAuthor && list.author_username) {
        secondLine = `<p class="list-card__author">by ${_lce(list.author_username)}</p>`;
    } else if (showBadge && list.is_public !== undefined) {
        const cls   = list.is_public ? 'public'  : 'private';
        const label = list.is_public ? 'Public'  : 'Private';
        secondLine = `<span class="list-card__badge list-card__badge--${cls}">${label}</span>`;
    }

    // ── Опис ────────────────────────────────────────────────────
    const descHtml = showDesc && list.description
        ? `<p class="list-card__desc">${_lce(list.description)}</p>`
        : '';

    // ── Мета ────────────────────────────────────────────────────
    const metaParts = [`<span class="list-card__stat">${list.film_count ?? 0} films</span>`];

    if (list.likes_count) {
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

    // ── CSS класи ────────────────────────────────────────────────
    const classes = ['list-card'];
    if (showBadge)  classes.push('list-card--owned');
    if (uniform)    classes.push('list-card--uniform');
    if (compact)    classes.push('list-card--compact');

    return `
        <a href="/list/${list.id}" class="${classes.join(' ')}">
            <div class="list-card__covers">${coverHtml}</div>
            <div class="list-card__body">
                <p class="list-card__title">${_lce(list.name)}</p>
                ${secondLine}
                ${descHtml}
                <div class="list-card__meta">${metaParts.join('')}</div>
            </div>
        </a>
    `.trim();
}

/**
 * Рендерить N skeleton карток у контейнер
 * @param {HTMLElement} container
 * @param {number} count
 */
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

// Внутрішній escape щоб не залежати від глобального escapeHtml
function _lce(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}