import { classifyZone } from './court/geometry.js';
import { createState, SCHEMA_VERSION } from './state.js';

export const STORAGE_KEY = 'shot-tracker:v1';
export const CORRUPT_PREFIX = 'shot-tracker:corrupt-';

const isNum = Number.isFinite;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const isValidShot = (s) => isObj(s) && isNum(s.x) && isNum(s.y) && typeof s.made === 'boolean' && isNum(s.t);

const isValidSession = (s) =>
  isObj(s) && typeof s.id === 'string' && isNum(s.startedAt) && Array.isArray(s.shots) && s.shots.every(isValidShot);

export function isValidState(d) {
  return (
    isObj(d) &&
    d.version === SCHEMA_VERSION &&
    typeof d.currentSessionId === 'string' &&
    Array.isArray(d.sessions) &&
    d.sessions.length > 0 &&
    d.sessions.every(isValidSession) &&
    d.sessions.some((s) => s.id === d.currentSessionId)
  );
}

// v1 is the only schema so far. Future versions upgrade step by step here.
export function migrate(data) {
  if (isObj(data) && data.version === SCHEMA_VERSION) return data;
  throw new Error(`Unsupported data version: ${isObj(data) ? data.version : typeof data}`);
}

// Geometry is the source of truth for zones.
function normalize(state) {
  return {
    ...state,
    sessions: state.sessions.map((s) => ({
      ...s,
      shots: s.shots
        .map((shot) => ({ ...shot, zone: classifyZone(shot.x, shot.y) }))
        .filter((shot) => shot.zone !== null),
    })),
  };
}

export function load(storage, now = Date.now()) {
  if (!storage) return { state: createState(now), warning: 'unavailable' };
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: createState(now), warning: 'unavailable' };
  }
  if (raw === null) return { state: createState(now), warning: null };
  try {
    const data = migrate(JSON.parse(raw));
    if (!isValidState(data)) throw new Error('Invalid saved state');
    return { state: normalize(data), warning: null };
  } catch {
    const state = createState(now);
    try {
      storage.setItem(CORRUPT_PREFIX + now, raw);
      // Only replace the corrupt data once it is safely backed up.
      save(storage, state);
    } catch {
      // Backup is best-effort; the app must still start.
    }
    return { state, warning: 'corrupt' };
  }
}

export function save(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
