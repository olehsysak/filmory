'use strict';

// convert ISO dates into relative time labels
document.querySelectorAll('.activity-item__date[data-date]').forEach(el => {

    const date = new Date(el.dataset.date);
    const now = new Date();

    // difference in seconds
    const diff = Math.floor((now - date) / 1000);

    // generate human-readable relative time
    let label;
    if (diff < 60)               label = 'just now';
    else if (diff < 3600)        label = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400)       label = `${Math.floor(diff / 3600)}h ago`;
    else if (diff < 86400 * 7)   label = `${Math.floor(diff / 86400)}d ago`;
    else if (diff < 86400 * 30)  label = `${Math.floor(diff / 86400 / 7)}w ago`;
    else if (diff < 86400 * 365) label = `${Math.floor(diff / 86400 / 30)}mo ago`;
    else                         label = `${Math.floor(diff / 86400 / 365)}y ago`;

    // replace original date text
    el.textContent = label;
});