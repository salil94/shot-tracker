import { ZONES } from './court/geometry.js';

export function pct(made, attempts) {
  return attempts === 0 ? null : Math.round((made / attempts) * 100);
}

export function zoneStats(shots) {
  const out = Object.fromEntries(ZONES.map((z) => [z, { made: 0, attempts: 0, pct: null }]));
  for (const s of shots) {
    const z = out[s.zone];
    if (!z) continue;
    z.attempts += 1;
    if (s.made) z.made += 1;
  }
  for (const z of Object.values(out)) z.pct = pct(z.made, z.attempts);
  return out;
}

export function totals(shots) {
  const made = shots.filter((s) => s.made).length;
  return { made, attempts: shots.length, pct: pct(made, shots.length) };
}

export function formatStat({ made, attempts, pct: p }) {
  return attempts === 0 ? '0/0' : `${made}/${attempts} · ${p}%`;
}
