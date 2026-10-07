import { currentSession, addShot, undoLastShot, startNewSession, allShots } from './state.js';
import { load, save } from './store.js';
import { zoneStats, totals } from './stats.js';

export function createApp({ storage, now = () => Date.now() }) {
  let { state, warning } = load(storage, now());
  let view = 'current';
  const listeners = new Set();

  function getSnapshot() {
    const session = currentSession(state);
    const shots = view === 'current' ? session.shots : allShots(state);
    return {
      view,
      warning,
      session,
      shots,
      zones: zoneStats(shots),
      totals: totals(shots),
      canUndo: session.shots.length > 0,
    };
  }

  function emit() {
    const snap = getSnapshot();
    for (const fn of listeners) fn(snap);
  }

  function commit(next) {
    if (next === state) return;
    state = next;
    if (!save(storage, state)) warning = 'unavailable';
    emit();
  }

  return {
    getSnapshot,
    subscribe(fn) {
      listeners.add(fn);
      fn(getSnapshot());
      return () => listeners.delete(fn);
    },
    logShot(x, y, made) {
      commit(addShot(state, { x, y, made }, now()));
    },
    undo() {
      commit(undoLastShot(state));
    },
    newSession() {
      commit(startNewSession(state, now()));
    },
    setView(next) {
      view = next;
      emit();
    },
    dismissWarning() {
      warning = null;
      emit();
    },
  };
}
