import { describe, it, expect } from 'vitest';
import { STORAGE_KEY, CORRUPT_PREFIX, load, save, isValidState } from '../src/store.js';
import { createState, addShot, currentSession } from '../src/state.js';
import { memoryStorage } from './helpers/memoryStorage.js';

const T0 = 1_760_000_000_000;

describe('load', () => {
  it('creates a fresh state when nothing is saved', () => {
    const { state, warning } = load(memoryStorage(), T0);
    expect(warning).toBeNull();
    expect(isValidState(state)).toBe(true);
    expect(currentSession(state).startedAt).toBe(T0);
  });

  it('round-trips through save', () => {
    const storage = memoryStorage();
    const s = addShot(createState(T0), { x: 0, y: 8, made: true }, T0);
    expect(save(storage, s)).toBe(true);
    expect(load(storage, T0 + 1)).toEqual({ state: s, warning: null });
  });

  it('recomputes zones from x/y and drops off-court shots', () => {
    const s = createState(T0);
    s.sessions[0].shots = [
      { x: 0, y: 0, made: true, zone: 'top3', t: T0 },
      { x: 0, y: 20, made: true, zone: 'top3', t: T0 },
    ];
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(s) });
    const { state } = load(storage, T0);
    expect(currentSession(state).shots).toEqual([{ x: 0, y: 0, made: true, zone: 'paint', t: T0 }]);
  });

  // Review Focus #3: valid JSON, wrong shape → backup + fresh start, never a crash.
  it.each([
    ['unparseable', '{not json'],
    ['null', 'null'],
    ['empty object', '{}'],
    ['array', '[]'],
    ['future version', JSON.stringify({ ...createState(T0), version: 2 })],
    ['dangling current id', JSON.stringify({ ...createState(T0), currentSessionId: 'nope' })],
    ['no sessions', JSON.stringify({ version: 1, currentSessionId: 'x', sessions: [] })],
    [
      'bad shot',
      JSON.stringify({
        version: 1,
        currentSessionId: 'a',
        sessions: [{ id: 'a', startedAt: T0, shots: [{ x: 'left', y: 0, made: true, t: T0 }] }],
      }),
    ],
  ])('backs up and resets corrupt data: %s', (_label, raw) => {
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const { state, warning } = load(storage, T0);
    expect(warning).toBe('corrupt');
    expect(isValidState(state)).toBe(true);
    expect(storage.map.get(CORRUPT_PREFIX + T0)).toBe(raw);
  });

  // Final review: without persisting the fresh state, every reload re-backed-up the
  // same corrupt blob (new key each time) and re-showed the banner.
  it('backs up corrupt data only once across reloads', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{bad' });
    expect(load(storage, T0).warning).toBe('corrupt');
    expect(load(storage, T0 + 1).warning).toBeNull();
    const backups = [...storage.map.keys()].filter((k) => k.startsWith(CORRUPT_PREFIX));
    expect(backups).toEqual([CORRUPT_PREFIX + T0]);
  });

  it('still recovers when the backup write itself fails', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{bad' }, { throwOnSet: true });
    expect(load(storage, T0).warning).toBe('corrupt');
  });

  // Review Focus #5: storage unavailable.
  it('reports unavailable when getItem throws', () => {
    const { state, warning } = load(memoryStorage({}, { throwOnGet: true }), T0);
    expect(warning).toBe('unavailable');
    expect(isValidState(state)).toBe(true);
  });

  it('reports unavailable when there is no storage at all', () => {
    expect(load(null, T0).warning).toBe('unavailable');
  });
});

describe('save', () => {
  it('returns false instead of throwing when setItem fails', () => {
    expect(save(memoryStorage({}, { throwOnSet: true }), createState(T0))).toBe(false);
  });
  it('returns false with no storage', () => {
    expect(save(null, createState(T0))).toBe(false);
  });
});
