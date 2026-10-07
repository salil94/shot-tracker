import { formatStat } from '../stats.js';

export const BANNER_TEXT = {
  corrupt: 'Saved data was unreadable, so it was backed up and a fresh start was made.',
  unavailable: 'Not saving: storage is unavailable in this browser.',
};

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function createControls(doc, { onNewSession, onUndo, onViewChange, onDismissBanner }) {
  const $ = (id) => doc.getElementById(id);
  const dateEl = $('session-date');
  const totalsEl = $('totals');
  const undoBtn = $('undo');
  const banner = $('banner');
  const bannerText = $('banner-text');
  const hint = $('hint');
  const viewBtns = [...doc.querySelectorAll('[data-view]')];

  $('new-session').addEventListener('click', () => onNewSession());
  undoBtn.addEventListener('click', () => onUndo());
  $('banner-dismiss').addEventListener('click', () => onDismissBanner());
  for (const b of viewBtns) b.addEventListener('click', () => onViewChange(b.dataset.view));

  return {
    update(snap) {
      dateEl.textContent = formatDate(snap.session.startedAt);
      totalsEl.textContent = formatStat(snap.totals);
      for (const b of viewBtns) b.setAttribute('aria-pressed', String(b.dataset.view === snap.view));
      undoBtn.disabled = !snap.canUndo;
      hint.hidden = !(snap.view === 'current' && snap.shots.length === 0);
      banner.hidden = !snap.warning;
      bannerText.textContent = snap.warning ? BANNER_TEXT[snap.warning] : '';
    },
  };
}
