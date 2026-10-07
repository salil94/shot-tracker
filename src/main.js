import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import plusIcon from '@phosphor-icons/core/bold/plus-bold.svg?raw';
import undoIcon from '@phosphor-icons/core/bold/arrow-counter-clockwise-bold.svg?raw';
import warningIcon from '@phosphor-icons/core/bold/warning-bold.svg?raw';
import xIcon from '@phosphor-icons/core/bold/x-bold.svg?raw';
import { createApp } from './app.js';
import { classifyZone } from './court/geometry.js';
import { createCourt } from './court/render.js';
import { createShotPicker } from './ui/shotPicker.js';
import { createControls } from './ui/controls.js';

const ICONS = { plus: plusIcon, undo: undoIcon, warning: warningIcon, x: xIcon };
for (const slot of document.querySelectorAll('[data-icon]')) slot.innerHTML = ICONS[slot.dataset.icon];

// Review Focus #5: the localStorage getter itself can throw (blocked site data).
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const app = createApp({ storage: getStorage() });
const court = createCourt(document.getElementById('court'));
const picker = createShotPicker(document.body);

const controls = createControls(document, {
  onNewSession() {
    const { session } = app.getSnapshot();
    if (session.shots.length === 0 || window.confirm('Start a new session?')) app.newSession();
  },
  onUndo: () => app.undo(),
  onViewChange: (view) => app.setView(view),
  onDismissBanner: () => app.dismissWarning(),
});

court.svg.addEventListener('click', (e) => {
  const p = court.clientToCourt(e.clientX, e.clientY);
  if (classifyZone(p.x, p.y) === null) return;
  court.setGhost(p);
  picker.open(
    { clientX: e.clientX, clientY: e.clientY },
    (made) => {
      court.setGhost(null);
      app.logShot(p.x, p.y, made);
    },
    () => court.setGhost(null),
  );
});

app.subscribe((snap) => {
  court.setZones(snap.zones);
  court.setDots(snap.view === 'current' ? snap.shots : []);
  controls.update(snap);
});
