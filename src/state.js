import { classifyZone } from './court/geometry.js';

export const SCHEMA_VERSION = 1;

export function newSession(now) {
  const rand = Math.random().toString(36).slice(2, 8);
  return { id: `s_${now.toString(36)}_${rand}`, startedAt: now, shots: [] };
}

export function createState(now) {
  const session = newSession(now);
  return { version: SCHEMA_VERSION, currentSessionId: session.id, sessions: [session] };
}

export function currentSession(state) {
  return state.sessions.find((s) => s.id === state.currentSessionId);
}

function updateCurrent(state, fn) {
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === state.currentSessionId ? fn(s) : s)),
  };
}

export function addShot(state, { x, y, made }, now) {
  const zone = classifyZone(x, y);
  if (zone === null) return state;
  const shot = { x, y, made: Boolean(made), zone, t: now };
  return updateCurrent(state, (s) => ({ ...s, shots: [...s.shots, shot] }));
}

export function undoLastShot(state) {
  if (currentSession(state).shots.length === 0) return state;
  return updateCurrent(state, (s) => ({ ...s, shots: s.shots.slice(0, -1) }));
}

export function startNewSession(state, now) {
  if (currentSession(state).shots.length === 0) return state;
  const session = newSession(now);
  return { ...state, currentSessionId: session.id, sessions: [...state.sessions, session] };
}

export function allShots(state) {
  return state.sessions.flatMap((s) => s.shots);
}
