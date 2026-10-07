import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { STORAGE_KEY } from '../src/store.js';
import { memoryStorage } from './helpers/memoryStorage.js';

const T0 = 1_760_000_000_000;
const clock = () => {
  let t = T0;
  return () => t++;
};

describe('createApp', () => {
  it('starts empty with nothing to undo', () => {
    const snap = createApp({ storage: memoryStorage(), now: clock() }).getSnapshot();
    expect(snap.view).toBe('current');
    expect(snap.warning).toBeNull();
    expect(snap.totals).toEqual({ made: 0, attempts: 0, pct: null });
    expect(snap.canUndo).toBe(false);
  });

  it('logs a shot, updates stats, and persists it', () => {
    const storage = memoryStorage();
    const app = createApp({ storage, now: clock() });
    app.logShot(0, 0, true);
    const snap = app.getSnapshot();
    expect(snap.totals).toEqual({ made: 1, attempts: 1, pct: 100 });
    expect(snap.zones.paint.attempts).toBe(1);
    expect(snap.canUndo).toBe(true);
    expect(createApp({ storage, now: clock() }).getSnapshot().totals.attempts).toBe(1);
  });

  it('ignores off-court taps without saving', () => {
    const storage = memoryStorage();
    const app = createApp({ storage, now: clock() });
    app.logShot(0, 20, true);
    expect(app.getSnapshot().totals.attempts).toBe(0);
    expect(storage.map.has(STORAGE_KEY)).toBe(false);
  });

  // Review Focus #4: undo / new session must survive a reload.
  it('persists undo so a reload does not bring the shot back', () => {
    const storage = memoryStorage();
    const app = createApp({ storage, now: clock() });
    app.logShot(0, 0, true);
    app.logShot(0, 8, false);
    app.undo();
    const reloaded = createApp({ storage, now: clock() }).getSnapshot();
    expect(reloaded.totals).toEqual({ made: 1, attempts: 1, pct: 100 });
  });

  it('persists a new session across reload', () => {
    const storage = memoryStorage();
    const app = createApp({ storage, now: clock() });
    app.logShot(0, 0, true);
    app.newSession();
    const reloaded = createApp({ storage, now: clock() });
    expect(reloaded.getSnapshot().totals.attempts).toBe(0);
    reloaded.setView('all');
    expect(reloaded.getSnapshot().totals.attempts).toBe(1);
  });

  it('switches between current-session and all-time shots', () => {
    const app = createApp({ storage: memoryStorage(), now: clock() });
    app.logShot(0, 0, true);
    app.newSession();
    app.logShot(0, 8, false);
    expect(app.getSnapshot().shots).toHaveLength(1);
    app.setView('all');
    const snap = app.getSnapshot();
    expect(snap.shots).toHaveLength(2);
    expect(snap.zones.paint.attempts).toBe(1);
    expect(snap.zones.top3.attempts).toBe(1);
    expect(snap.canUndo).toBe(true); // undo always targets the current session
  });

  it('keeps working in memory and warns when saving fails', () => {
    const app = createApp({ storage: memoryStorage({}, { throwOnSet: true }), now: clock() });
    app.logShot(0, 0, true);
    const snap = app.getSnapshot();
    expect(snap.totals.attempts).toBe(1);
    expect(snap.warning).toBe('unavailable');
  });

  it('surfaces a corrupt-data warning that can be dismissed', () => {
    const app = createApp({ storage: memoryStorage({ [STORAGE_KEY]: '{bad' }), now: clock() });
    expect(app.getSnapshot().warning).toBe('corrupt');
    app.dismissWarning();
    expect(app.getSnapshot().warning).toBeNull();
  });

  it('notifies subscribers immediately and on every change', () => {
    const app = createApp({ storage: memoryStorage(), now: clock() });
    const fn = vi.fn();
    const unsubscribe = app.subscribe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    app.logShot(0, 0, true);
    app.setView('all');
    expect(fn).toHaveBeenCalledTimes(3);
    unsubscribe();
    app.undo();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
