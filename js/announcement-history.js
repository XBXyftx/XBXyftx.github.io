'use strict';

const INITIALIZED_ATTRIBUTE = 'data-announcement-history-ready';

function initAnnouncementHistory() {
  document.querySelectorAll('.card-announcement').forEach(card => {
    if (card.hasAttribute(INITIALIZED_ATTRIBUTE)) return;

    const toggle = card.querySelector('.announcement-history-toggle');
    if (!toggle) return;

    const collapsedEntries = Array.from(card.querySelectorAll('.is-collapsed-history'));
    if (!collapsedEntries.length) {
      toggle.hidden = true;
      return;
    }

    const setExpanded = expanded => {
      collapsedEntries.forEach(entry => {
        entry.hidden = !expanded;
      });
      card.classList.toggle('is-history-expanded', expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
    };

    toggle.addEventListener('click', () => {
      setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
    });

    setExpanded(false);
    card.setAttribute(INITIALIZED_ATTRIBUTE, '');
  });
}

document.addEventListener('DOMContentLoaded', initAnnouncementHistory);
document.addEventListener('pjax:complete', initAnnouncementHistory);
