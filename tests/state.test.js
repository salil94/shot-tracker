import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  newSession,
  createState,
  currentSession,
  addShot,
  undoLastShot,
  startNewSession,
  allShots,
} from '../src/state.js';

const T0 = 1_760_000_000_000;

describe('createState', () => {
  it('starts with one empty current session', () => {
    const s = createState(T0);
    expect(s.version).toBe(SCHEMA_VERSION);
    expect(s.sessions).toHaveLength(1);
    expect(currentSession(s)).toEqual({ id: s.currentSessionId, startedAt: T0, shots: [] });
  });
});

describe('newSession', () => {
  it('creates unique ids even at the same timestamp', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newSession(T0).id));
    expect(ids.size).toBe(50);
  });
});

describe('addShot', () => {
  it('appends a classified shot to the current session without mutating', () => {
    const s0 = createState(T0);
    const s1 = addShot(s0, { x: 0, y: 0, made: true }, T0 + 1);
    expect(currentSession(s1).shots).toEqual([{ x: 0, y: 0, made: true, zone: 'restricted', t: T0 + 1 }]);
    expect(currentSession(s0).shots).toEqual([]);
  });

  it('returns the same state for off-court or invalid points', () => {
    const s0 = createState(T0);
    expect(addShot(s0, { x: 0, y: 13, made: true }, T0)).toBe(s0);
    expect(addShot(s0, { x: NaN, y: 0, made: true }, T0)).toBe(s0);
  });
});

describe('undoLastShot', () => {
  it('removes the most recent shot of the current session', () => {
    let s = createState(T0);
    s = addShot(s, { x: 0, y: 0, made: true }, T0);
    s = addShot(s, { x: 0, y: 8, made: false }, T0);
    s = undoLastShot(s);
    expect(currentSession(s).shots.map((x) => x.zone)).toEqual(['restricted']);
  });

  it('returns the same state when there is nothing to undo', () => {
    const s0 = createState(T0);
    expect(undoLastShot(s0)).toBe(s0);
  });
});

describe('startNewSession', () => {
  it('reuses an empty current session', () => {
    const s0 = createState(T0);
    expect(startNewSession(s0, T0 + 5)).toBe(s0);
  });

  it('adds and switches to a new session when the current one has shots', () => {
    const s1 = addShot(createState(T0), { x: 0, y: 0, made: true }, T0);
    const s2 = startNewSession(s1, T0 + 5);
    expect(s2.sessions).toHaveLength(2);
    expect(s2.currentSessionId).not.toBe(s1.currentSessionId);
    expect(currentSession(s2)).toMatchObject({ startedAt: T0 + 5, shots: [] });
    expect(s2.sessions[0].shots).toHaveLength(1);
  });
});

describe('allShots', () => {
  it('flattens shots across sessions', () => {
    let s = addShot(createState(T0), { x: 0, y: 0, made: true }, T0);
    s = startNewSession(s, T0 + 1);
    s = addShot(s, { x: 0, y: 8, made: false }, T0 + 2);
    expect(allShots(s).map((x) => x.zone)).toEqual(['restricted', 'top3']);
  });
});
