# Shot Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This project:** the user chose **inline execution (no subagents)** → use superpowers:executing-plans. Track phases in `task_plan.md` / `progress.md` (planning-with-files).

**Goal:** A phone-first vanilla-JS web app to log basketball shots on a FIBA half-court and see FG% by zone as a heatmap, persisted in localStorage.

**Architecture:** Inline SVG court in metre coordinates (viewBox = court, origin at basket centre, so no transform math). All logic lives in pure modules (`geometry`, `stats`, `heatmap`, `state`, `store`, `app`) that are unit-tested in Node. Thin DOM modules (`render`, `shotPicker`, `controls`) are tested with jsdom, and `main.js` only wires them together. Data flow: action → pure state update → save → notify subscribers → render.

**Tech Stack:** Vite (Node ≥ 20.19 / 22.12; machine has v24.18), Vitest, jsdom (per-file `// @vitest-environment jsdom`). Runtime assets only: `@fontsource-variable/geist` + `@fontsource-variable/geist-mono` (self-hosted fonts) and `@phosphor-icons/core` (icon SVGs imported with `?raw`).

**Visual design (design-taste-frontend + dataviz):**
- *Design read:* a single-screen phone utility for a solo player mid-workout, with a sporty-utilitarian, high-contrast look, built on native CSS tokens + Geist/Geist Mono + Phosphor icons.
- *Dials:* `DESIGN_VARIANCE 3` (the court is a fixed, symmetric centrepiece), `MOTION_INTENSITY 3` (feedback only: button press, popover entrance, zone colour change; all off under reduced motion), `VISUAL_DENSITY 5`.
- *Colour roles:* zinc neutrals, with **one accent (emerald)** used only for the Make button and focus rings. The heatmap is a **diverging blue↔red scale with a grey midpoint**, in 7 bins (3 per side). Made/miss is shown by **shape, not colour**: a filled ink dot for a make, an ink × for a miss, both with a 2 px surface halo. Empty zones are **hatched**, so "no data" never looks like "average".
- *Shape lock:* 12 px radius on every control and panel. The segmented toggle's inner buttons are square inside a 12 px clipped container.
- *Copy:* no em/en dashes, no emoji or text glyph icons (Phosphor only), at most one middle dot per line.

**Spec:** `docs/superpowers/specs/2026-10-07-shot-tracker-design.md`

## Global Constraints

- Vanilla JS ES modules + Vite. No UI framework. Runtime packages are limited to the two Fontsource fonts and `@phosphor-icons/core`.
- FIBA court in metres. Origin = basket centre, +y toward half-court, baseline y = −1.575, half-court line y = 12.425, x ∈ [−7.5, 7.5].
- Paint 4.9 m wide × 5.8 m from baseline. 3pt arc radius 6.75. Corner lines at |x| = 6.6. Corner/arc break y = √(6.75² − 6.6²) ≈ 1.415.
- Zone ids exactly: `paint`, `mid`, `corner3`, `wing3`, `top3`. A shot on the 3pt line counts as 2. Top/wing split at 22.5° from straight-on.
- Heatmap anchors: 2pt cold ≤ 30% / hot ≥ 60%; 3pt cold ≤ 20% / hot ≥ 45%. 7 diverging bins `c3 c2 c1 n h1 h2 h3`. 0 attempts = hatched; 1–2 attempts = 35% fill-opacity.
- Heat tokens (validated in OKLCH: lightness changes steadily on each side and the two sides mirror; the poles' colourblind ΔE is ≈ 19):
  - light `c3 #1c5cab  c2 #5598e7  c1 #9ec5f4  n #f0efec  h1 #f3ada7  h2 #e06e68  h3 #a1302f`
  - dark  `c3 #5598e7  c2 #2a78d6  c1 #1c5cab  n #383835  h1 #a1302f  h2 #ca4442  h3 #e06e68`
- localStorage key `shot-tracker:v1`, schema `version: 1`. Corrupt data is backed up to `shot-tracker:corrupt-<timestamp>`.
- Popover buttons ≥ 56 px. Primary viewport 390×844 portrait.
- Out of scope: export, trends, session history list, PWA, left/right split.
- TDD: every module with logic gets its failing test first. Commit after each task.

## Review Focus

Spec-implied failure modes that no other test covers. Each one is pinned by a test in the task listed:

1. **Tap near a screen edge** (corner 3 / wing by the sideline): the Make/Miss popover must stay fully on screen. *Task 8 (`placePopover` tests).*
2. **Rapid double-tap on Make**: must record exactly one shot. *Task 8 (picker double-click test).*
3. **Saved data that is valid JSON but the wrong shape** (`null`, `{}`, `[]`, a dangling `currentSessionId`, a future `version`): must be backed up and replaced with a fresh start plus a banner, never a crash. *Task 5.*
4. **Undo or New session, then reload**: the change must already be saved, so an undone shot never comes back. *Task 6.*
5. **localStorage itself throws** (Safari private mode, blocked site data, or the `window.localStorage` getter throwing): the app keeps working in memory and shows the "Not saving" banner. *Task 5 (null or throwing storage) + Task 9 (`getStorage()` guard).*

---

## File Structure

```
package.json            scripts: dev, build, preview, test
vite.config.js          Vitest config (node env, tests/**/*.test.js)
.gitignore
index.html              static shell: header, banner, totals/toggle, #court, undo bar
src/
  main.js               wiring only (no logic worth testing)
  style.css
  court/geometry.js     COURT constants, ZONES, THREE_POINT_ZONES, isInBounds, isThree, classifyZone
  court/render.js       zonePaths, courtLinePaths, LABEL_ANCHORS, createCourt
  stats.js              pct, zoneStats, totals, formatStat
  heatmap.js            ANCHORS, TONES, heatT, heatTone, zoneTone
  state.js              SCHEMA_VERSION, newSession, createState, currentSession, addShot, undoLastShot, startNewSession, allShots
  store.js              STORAGE_KEY, CORRUPT_PREFIX, isValidState, migrate, load, save
  app.js                createApp: state + view + persistence + subscribers
  ui/shotPicker.js      placePopover, createShotPicker
  ui/controls.js        BANNER_TEXT, formatDate, createControls
tests/
  helpers/memoryStorage.js
  geometry.test.js  stats.test.js  heatmap.test.js  state.test.js  store.test.js
  app.test.js  render.test.js  shotPicker.test.js  controls.test.js
```

Note: the spec put session operations inside `store.js`. This plan splits them into `state.js` (pure) and `store.js` (I/O) so the pure half can be tested without fake storage. The behaviour is unchanged.

---

### Task 1: Project setup + court geometry

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `src/court/geometry.js`
- Test: `tests/geometry.test.js`

**Interfaces:**
- Produces: `COURT` (object of numeric constants, see code), `ZONES: string[]`, `THREE_POINT_ZONES: Set<string>`, `isInBounds(x, y): boolean`, `isThree(x, y): boolean`, `classifyZone(x, y): 'paint'|'mid'|'corner3'|'wing3'|'top3'|null`

- [ ] **Step 1: Create project files**

`package.json`:
```json
{
  "name": "shot-tracker",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`vite.config.js`:
```js
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

`.gitignore`:
```
node_modules
dist
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install -D vite vitest jsdom`
Run: `npm install @fontsource-variable/geist @fontsource-variable/geist-mono @phosphor-icons/core`
Expected: `package.json` has `devDependencies` (vite, vitest, jsdom) and `dependencies` (the two fonts and Phosphor core), and `package-lock.json` is created. Record the installed versions in `findings.md`. The versions verified on 2026-10-07 were Geist 5.3.0, Geist Mono 5.3.0 and Phosphor core 2.1.1, which ships `regular/*.svg` and `bold/*.svg` exports.

- [ ] **Step 3: Write the failing test** — `tests/geometry.test.js`

```js
import { describe, it, expect } from 'vitest';
import { COURT, ZONES, classifyZone, isInBounds, isThree } from '../src/court/geometry.js';

const atAngle = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), r * Math.cos(a)];
};

describe('COURT', () => {
  it('puts the corner/arc break 2.99 m from the baseline (FIBA)', () => {
    expect(COURT.breakY - COURT.baselineY).toBeCloseTo(2.99, 2);
  });
  it('lists the five zones', () => {
    expect(ZONES).toEqual(['paint', 'mid', 'corner3', 'wing3', 'top3']);
  });
});

describe('isInBounds', () => {
  it('accepts court edges and rejects beyond them', () => {
    expect(isInBounds(7.5, 12.425)).toBe(true);
    expect(isInBounds(-7.5, -1.575)).toBe(true);
    expect(isInBounds(7.51, 0)).toBe(false);
    expect(isInBounds(0, 12.43)).toBe(false);
    expect(isInBounds(0, -1.58)).toBe(false);
  });
});

describe('isThree', () => {
  it('is false exactly on the line (on the line = two)', () => {
    expect(isThree(0, 6.75)).toBe(false);
    expect(isThree(6.6, 0)).toBe(false);
  });
  it('is true just beyond the line', () => {
    expect(isThree(0, 6.76)).toBe(true);
    expect(isThree(6.61, 0)).toBe(true);
  });
});

describe('classifyZone', () => {
  it.each([
    // paint (edges inclusive)
    [0, 0, 'paint'],
    [2.45, 4.225, 'paint'],
    [-2.45, -1.575, 'paint'],
    // mid-range
    [2.46, 0, 'mid'],
    [0, 4.23, 'mid'],
    [0, 6.75, 'mid'], // exactly on the arc
    [6.6, 0, 'mid'], // exactly on the corner line
    [4.55, 1.6, 'mid'],
    // corner 3 (y <= break)
    [6.61, 0, 'corner3'],
    [-6.61, -1.5, 'corner3'],
    [7.4, 1.41, 'corner3'],
    // above the break, beyond the arc
    [6.7, 1.5, 'wing3'],
    [7.4, 12, 'wing3'],
    // straight on
    [0, 6.76, 'top3'],
    [0, 12, 'top3'],
  ])('(%s, %s) → %s', (x, y, zone) => {
    expect(classifyZone(x, y)).toBe(zone);
  });

  it('splits top/wing at 22.5° from straight-on, both sides', () => {
    expect(classifyZone(...atAngle(22, 8))).toBe('top3');
    expect(classifyZone(...atAngle(-22, 8))).toBe('top3');
    expect(classifyZone(...atAngle(23, 8))).toBe('wing3');
    expect(classifyZone(...atAngle(-23, 8))).toBe('wing3');
  });

  it.each([
    [0, 12.43],
    [7.51, 0],
    [0, -1.58],
    [NaN, 0],
    [0, Infinity],
  ])('returns null outside the court: (%s, %s)', (x, y) => {
    expect(classifyZone(x, y)).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/geometry.test.js`
Expected: FAIL with "Failed to load url ../src/court/geometry.js" (or "Cannot find module").

- [ ] **Step 5: Write the implementation** — `src/court/geometry.js`

```js
// FIBA half-court in metres. Origin = basket centre, +x toward the right
// sideline, +y from the baseline toward half-court (matches SVG y-down with
// the baseline at the top of the screen).
const THREE_RADIUS = 6.75;
const CORNER_X = 6.6;

export const COURT = {
  halfWidth: 7.5,
  baselineY: -1.575,
  halfCourtY: 12.425,
  paintHalfWidth: 2.45,
  paintTopY: 4.225, // 5.8 m from the baseline
  threeRadius: THREE_RADIUS,
  cornerX: CORNER_X,
  breakY: Math.sqrt(THREE_RADIUS ** 2 - CORNER_X ** 2), // ≈ 1.415 (2.99 m from baseline)
  topAngleDeg: 22.5,
  ftCircleRadius: 1.8,
  centerCircleRadius: 1.8,
  rimRadius: 0.225,
  backboardY: -0.375, // 1.2 m from the baseline
  backboardHalfWidth: 0.9,
};

export const ZONES = ['paint', 'mid', 'corner3', 'wing3', 'top3'];
export const THREE_POINT_ZONES = new Set(['corner3', 'wing3', 'top3']);

export function isInBounds(x, y) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Math.abs(x) <= COURT.halfWidth &&
    y >= COURT.baselineY &&
    y <= COURT.halfCourtY
  );
}

// A shot exactly on the line is a two.
export function isThree(x, y) {
  if (y <= COURT.breakY) return Math.abs(x) > COURT.cornerX;
  return Math.hypot(x, y) > COURT.threeRadius;
}

export function classifyZone(x, y) {
  if (!isInBounds(x, y)) return null;
  if (isThree(x, y)) {
    if (y <= COURT.breakY) return 'corner3';
    const angle = (Math.abs(Math.atan2(x, y)) * 180) / Math.PI;
    return angle <= COURT.topAngleDeg ? 'top3' : 'wing3';
  }
  if (Math.abs(x) <= COURT.paintHalfWidth && y <= COURT.paintTopY) return 'paint';
  return 'mid';
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/geometry.test.js`
Expected: PASS (all cases).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js .gitignore src/court/geometry.js tests/geometry.test.js
git commit -m "feat: project setup and FIBA court zone classification"
```

---

### Task 2: Stats

**Files:**
- Create: `src/stats.js`
- Test: `tests/stats.test.js`

**Interfaces:**
- Consumes: `ZONES` from `src/court/geometry.js`
- Produces: `pct(made, attempts): number|null` (integer percent), `zoneStats(shots): { [zone]: { made, attempts, pct } }` (always has all 5 zones), `totals(shots): { made, attempts, pct }`, `formatStat({ made, attempts, pct }): string`. A shot is `{ x, y, made: boolean, zone, t }`.

- [ ] **Step 1: Write the failing test** — `tests/stats.test.js`

```js
import { describe, it, expect } from 'vitest';
import { pct, zoneStats, totals, formatStat } from '../src/stats.js';

const shot = (zone, made) => ({ x: 0, y: 0, zone, made, t: 0 });

describe('pct', () => {
  it('rounds to a whole percent and is null with no attempts', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(7, 12)).toBe(58);
    expect(pct(0, 0)).toBeNull();
  });
});

describe('zoneStats', () => {
  it('returns every zone empty for no shots', () => {
    const s = zoneStats([]);
    expect(Object.keys(s)).toEqual(['paint', 'mid', 'corner3', 'wing3', 'top3']);
    for (const z of Object.values(s)) expect(z).toEqual({ made: 0, attempts: 0, pct: null });
  });

  it('counts makes and attempts per zone', () => {
    const s = zoneStats([
      shot('paint', true),
      shot('paint', false),
      shot('paint', true),
      shot('top3', true),
    ]);
    expect(s.paint).toEqual({ made: 2, attempts: 3, pct: 67 });
    expect(s.top3).toEqual({ made: 1, attempts: 1, pct: 100 });
    expect(s.mid).toEqual({ made: 0, attempts: 0, pct: null });
  });

  it('ignores shots with an unknown zone', () => {
    const s = zoneStats([shot('bogus', true)]);
    expect(Object.values(s).every((z) => z.attempts === 0)).toBe(true);
  });
});

describe('totals', () => {
  it('sums across all zones', () => {
    expect(totals([shot('paint', true), shot('wing3', false)])).toEqual({ made: 1, attempts: 2, pct: 50 });
    expect(totals([])).toEqual({ made: 0, attempts: 0, pct: null });
  });
});

describe('formatStat', () => {
  it('formats made/attempts · pct%', () => {
    expect(formatStat({ made: 7, attempts: 12, pct: 58 })).toBe('7/12 · 58%');
  });
  it('shows 0/0 with no attempts', () => {
    expect(formatStat({ made: 0, attempts: 0, pct: null })).toBe('0/0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stats.test.js`
Expected: FAIL, the module isn't found.

- [ ] **Step 3: Write the implementation** — `src/stats.js`

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stats.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stats.js tests/stats.test.js
git commit -m "feat: per-zone and total FG% stats"
```

---

### Task 3: Heatmap tone scale (diverging, binned)

**Files:**
- Create: `src/heatmap.js`
- Test: `tests/heatmap.test.js`

**Interfaces:**
- Consumes: `THREE_POINT_ZONES` from `src/court/geometry.js`
- Produces: `ANCHORS`, `TONES = ['c3','c2','c1','n','h1','h2','h3']`, `MIN_CONFIDENT_ATTEMPTS = 3`, `heatT(zone, ratio): number` in [0, 1], `heatTone(zone, ratio): Tone`, `zoneTone(zone, { made, attempts }): { tone: Tone | 'empty', lowConfidence: boolean }`.
- The module returns **tone names, not colours**. Colours live in CSS tokens (`--heat-c3` … `--heat-h3`) so light and dark mode each get their own validated steps (dataviz rule: dark mode is selected, not flipped).

- [ ] **Step 1: Write the failing test** — `tests/heatmap.test.js`

```js
import { describe, it, expect } from 'vitest';
import { heatT, heatTone, zoneTone, TONES } from '../src/heatmap.js';

describe('heatT', () => {
  it('uses 30%→60% anchors for 2pt zones', () => {
    expect(heatT('paint', 0.3)).toBe(0);
    expect(heatT('mid', 0.45)).toBeCloseTo(0.5);
    expect(heatT('paint', 0.6)).toBeCloseTo(1);
  });
  it('uses 20%→45% anchors for 3pt zones', () => {
    expect(heatT('top3', 0.2)).toBe(0);
    expect(heatT('wing3', 0.325)).toBeCloseTo(0.5);
    expect(heatT('corner3', 0.45)).toBeCloseTo(1);
  });
  it('clamps outside the anchors', () => {
    expect(heatT('paint', 0.1)).toBe(0);
    expect(heatT('paint', 0.95)).toBe(1);
    expect(heatT('top3', 0)).toBe(0);
    expect(heatT('top3', 1)).toBe(1);
  });
});

describe('heatTone', () => {
  it('has three cold bins, a neutral midpoint, and three hot bins', () => {
    expect(TONES).toEqual(['c3', 'c2', 'c1', 'n', 'h1', 'h2', 'h3']);
  });
  it('maps anchors to the ends and the midpoint to neutral', () => {
    expect(heatTone('paint', 0.3)).toBe('c3');
    expect(heatTone('mid', 0.45)).toBe('n');
    expect(heatTone('paint', 0.6)).toBe('h3');
    expect(heatTone('top3', 0.2)).toBe('c3');
    expect(heatTone('top3', 0.45)).toBe('h3');
  });
  it('rates 40% from three as hot and 40% in the paint as cold', () => {
    expect(heatTone('top3', 0.4)).toBe('h2');
    expect(heatTone('paint', 0.4)).toBe('c1');
  });
});

describe('zoneTone', () => {
  it('is empty (hatched) with no attempts, never the neutral tone', () => {
    expect(zoneTone('paint', { made: 0, attempts: 0 })).toEqual({ tone: 'empty', lowConfidence: false });
  });
  it('flags low confidence below 3 attempts', () => {
    expect(zoneTone('paint', { made: 1, attempts: 1 })).toEqual({ tone: 'h3', lowConfidence: true });
    expect(zoneTone('paint', { made: 1, attempts: 2 }).lowConfidence).toBe(true);
  });
  it('is confident from 3 attempts', () => {
    expect(zoneTone('top3', { made: 0, attempts: 3 })).toEqual({ tone: 'c3', lowConfidence: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heatmap.test.js`
Expected: FAIL, the module isn't found.

- [ ] **Step 3: Write the implementation** — `src/heatmap.js`

```js
import { THREE_POINT_ZONES } from './court/geometry.js';

// FG% at which a zone is fully cold / fully hot. Threes are judged on a lower scale.
export const ANCHORS = {
  two: { cold: 0.3, hot: 0.6 },
  three: { cold: 0.2, hot: 0.45 },
};

// Diverging bins: cold arm, neutral midpoint, hot arm. Colours are CSS tokens (--heat-<tone>).
export const TONES = ['c3', 'c2', 'c1', 'n', 'h1', 'h2', 'h3'];
export const MIN_CONFIDENT_ATTEMPTS = 3;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function heatT(zone, ratio) {
  const { cold, hot } = THREE_POINT_ZONES.has(zone) ? ANCHORS.three : ANCHORS.two;
  return clamp01((ratio - cold) / (hot - cold));
}

export function heatTone(zone, ratio) {
  return TONES[Math.round(heatT(zone, ratio) * (TONES.length - 1))];
}

export function zoneTone(zone, { made, attempts }) {
  if (attempts === 0) return { tone: 'empty', lowConfidence: false };
  return { tone: heatTone(zone, made / attempts), lowConfidence: attempts < MIN_CONFIDENT_ATTEMPTS };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heatmap.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/heatmap.js tests/heatmap.test.js
git commit -m "feat: diverging heatmap tone bins with 2pt/3pt anchors"
```

---

### Task 4: Pure session state

**Files:**
- Create: `src/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: `classifyZone` from `src/court/geometry.js`
- Produces (all pure; mutations return a **new** state, or the **same** object when nothing changed):
  - `SCHEMA_VERSION = 1`
  - `newSession(now: number): { id, startedAt, shots: [] }`
  - `createState(now): { version, currentSessionId, sessions: [session] }`
  - `currentSession(state): session`
  - `addShot(state, { x, y, made }, now): state` (unchanged if the point is off court)
  - `undoLastShot(state): state` (unchanged if the current session is empty)
  - `startNewSession(state, now): state` (unchanged if the current session is empty, so it gets reused)
  - `allShots(state): shot[]`

- [ ] **Step 1: Write the failing test** — `tests/state.test.js`

```js
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
    expect(currentSession(s1).shots).toEqual([{ x: 0, y: 0, made: true, zone: 'paint', t: T0 + 1 }]);
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
    expect(currentSession(s).shots.map((x) => x.zone)).toEqual(['paint']);
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
    expect(allShots(s).map((x) => x.zone)).toEqual(['paint', 'top3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state.test.js`
Expected: FAIL, the module isn't found.

- [ ] **Step 3: Write the implementation** — `src/state.js`

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: pure session state operations"
```

---

### Task 5: localStorage persistence

**Files:**
- Create: `src/store.js`, `tests/helpers/memoryStorage.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: `classifyZone` (geometry), `createState`, `SCHEMA_VERSION` (state)
- Produces: `STORAGE_KEY = 'shot-tracker:v1'`, `CORRUPT_PREFIX = 'shot-tracker:corrupt-'`, `isValidState(data): boolean`, `migrate(data): state` (throws on unknown version), `load(storage | null, now): { state, warning: null | 'corrupt' | 'unavailable' }`, `save(storage | null, state): boolean`. `storage` is anything with `getItem` and `setItem` (Storage-like). `load` and `save` **never throw**.
- Test helper: `memoryStorage(initial?: object, { throwOnGet?, throwOnSet? }?)`

- [ ] **Step 1: Write the test helper** — `tests/helpers/memoryStorage.js`

```js
// Minimal Storage stand-in. Options simulate private mode / quota errors.
export function memoryStorage(initial = {}, { throwOnGet = false, throwOnSet = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) {
      if (throwOnGet) throw new Error('SecurityError');
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('QuotaExceededError');
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}
```

- [ ] **Step 2: Write the failing test** — `tests/store.test.js`

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/store.test.js`
Expected: FAIL, `src/store.js` isn't found.

- [ ] **Step 4: Write the implementation** — `src/store.js`

```js
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
    try {
      storage.setItem(CORRUPT_PREFIX + now, raw);
    } catch {
      // Backup is best-effort; the app must still start.
    }
    return { state: createState(now), warning: 'corrupt' };
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/store.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store.js tests/store.test.js tests/helpers/memoryStorage.js
git commit -m "feat: versioned localStorage persistence with corrupt-data recovery"
```

---

### Task 6: App controller

**Files:**
- Create: `src/app.js`
- Test: `tests/app.test.js`

**Interfaces:**
- Consumes: `state.js` (`currentSession`, `addShot`, `undoLastShot`, `startNewSession`, `allShots`), `store.js` (`load`, `save`), `stats.js` (`zoneStats`, `totals`)
- Produces: `createApp({ storage, now = () => Date.now() })` returning:
  - `getSnapshot(): { view: 'current'|'all', warning, session, shots, zones, totals, canUndo }`. `shots` is the current session's shots in `'current'` view and every shot in `'all'` view. `zones` = `zoneStats(shots)`, `totals` = `totals(shots)`, `canUndo` = current session has shots.
  - `subscribe(fn): unsubscribe`. Calls `fn(snapshot)` immediately and after every change.
  - `logShot(x, y, made)`, `undo()`, `newSession()`, `setView(view)`, `dismissWarning()`
  - Every state mutation is saved right away. A failed save sets `warning = 'unavailable'`, and the in-memory state still updates.

- [ ] **Step 1: Write the failing test** — `tests/app.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app.test.js`
Expected: FAIL, `src/app.js` isn't found.

- [ ] **Step 3: Write the implementation** — `src/app.js`

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/app.test.js
git commit -m "feat: app controller with immediate persistence"
```

---

### Task 7: SVG court renderer

**Files:**
- Create: `src/court/render.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `COURT`, `ZONES`, `classifyZone` (geometry), `zoneTone` (heatmap), `formatStat` (stats)
- Produces:
  - `zonePaths(): { [zone]: string }`, SVG path data in court metres. `mid` uses `fill-rule="evenodd"` with the paint as a hole.
  - `courtLinePaths(): string[]`
  - `LABEL_ANCHORS: { [zone]: Array<{ x, y, rotate? }> }`
  - `createCourt(container): { svg, setZones(zoneStats), setDots(shots), setGhost({x,y}|null), clientToCourt(clientX, clientY): {x,y} }`. `clientToCourt` returns `{NaN, NaN}` if the SVG has no screen CTM, and `classifyZone` rejects that.
- Zone colour contract with CSS (Task 9): every zone path carries `data-tone="c3|c2|c1|n|h1|h2|h3|empty"` and, when there are fewer than 3 attempts, a boolean `data-low` attribute. CSS maps tones to `--heat-*` tokens. `empty` fills with the `#no-data` hatch pattern defined in this SVG.
- Shot marks are encoded by **shape**: a make is `<circle class="dot made">`, and a miss is `<g class="dot miss">` holding two paths (`.halo`, `.ink`) that draw an ×.

SVG facts: `viewBox="-7.5 -1.575 15 14"`, so court coordinates and SVG user units are the same thing and the baseline sits at the top of the screen. The layers, from bottom to top, are defs, zones, lines, labels, dots, then ghost. Everything except the zones has `pointer-events: none` (set in CSS, Task 9).

- [ ] **Step 1: Write the failing test** — `tests/render.test.js`

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createCourt, zonePaths, LABEL_ANCHORS } from '../src/court/render.js';
import { ZONES, classifyZone } from '../src/court/geometry.js';
import { zoneStats } from '../src/stats.js';

const shot = (x, y, zone, made) => ({ x, y, zone, made, t: 0 });

describe('zonePaths', () => {
  it('has well-formed path data for every zone', () => {
    const paths = zonePaths();
    expect(Object.keys(paths)).toEqual(ZONES);
    for (const d of Object.values(paths)) {
      expect(d).toMatch(/^M /);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('LABEL_ANCHORS', () => {
  it('places every label inside its own zone', () => {
    for (const zone of ZONES) {
      for (const { x, y } of LABEL_ANCHORS[zone]) expect(classifyZone(x, y)).toBe(zone);
    }
  });
});

describe('createCourt', () => {
  let container;
  let court;
  const zoneEl = (z) => court.svg.querySelector(`[data-zone="${z}"]`);

  beforeEach(() => {
    document.body.innerHTML = '<main id="court"></main>';
    container = document.getElementById('court');
    court = createCourt(container);
  });

  it('renders one svg with a path per zone and a no-data pattern', () => {
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(court.svg.getAttribute('viewBox')).toBe('-7.5 -1.575 15 14');
    const zones = [...court.svg.querySelectorAll('[data-zone]')].map((n) => n.getAttribute('data-zone'));
    expect(zones).toEqual(ZONES);
    expect(court.svg.querySelector('pattern#no-data')).not.toBeNull();
  });

  it('tags zones with tone and confidence from stats', () => {
    court.setZones(
      zoneStats([
        shot(0, 0, 'paint', true),
        shot(0, 0, 'paint', true),
        shot(0, 0, 'paint', true),
        shot(4.5, 1.6, 'mid', false),
      ]),
    );
    expect(zoneEl('paint').getAttribute('data-tone')).toBe('h3');
    expect(zoneEl('paint').hasAttribute('data-low')).toBe(false);
    expect(zoneEl('mid').getAttribute('data-tone')).toBe('c3');
    expect(zoneEl('mid').hasAttribute('data-low')).toBe(true);
    expect(zoneEl('top3').getAttribute('data-tone')).toBe('empty');
    const labels = [...court.svg.querySelectorAll('.labels text')].map((t) => t.textContent);
    expect(labels).toContain('3/3 · 100%');
  });

  it('clears low confidence once a zone reaches 3 attempts', () => {
    court.setZones(zoneStats([shot(0, 0, 'paint', true)]));
    court.setZones(zoneStats([shot(0, 0, 'paint', true), shot(0, 0, 'paint', true), shot(0, 0, 'paint', true)]));
    expect(zoneEl('paint').hasAttribute('data-low')).toBe(false);
  });

  it('draws makes as dots and misses as crosses, and clears them', () => {
    court.setDots([shot(0, 0, 'paint', true), shot(0, 8, 'top3', false)]);
    expect(court.svg.querySelectorAll('circle.dot.made')).toHaveLength(1);
    const miss = court.svg.querySelectorAll('g.dot.miss');
    expect(miss).toHaveLength(1);
    expect(miss[0].querySelectorAll('path')).toHaveLength(2);
    court.setDots([]);
    expect(court.svg.querySelectorAll('.dot')).toHaveLength(0);
  });

  it('shows and hides the ghost dot', () => {
    const ghost = court.svg.querySelector('.ghost');
    court.setGhost({ x: 1, y: 2 });
    expect(ghost.getAttribute('visibility')).toBe('visible');
    expect(ghost.getAttribute('cx')).toBe('1');
    court.setGhost(null);
    expect(ghost.getAttribute('visibility')).toBe('hidden');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render.test.js`
Expected: FAIL, `src/court/render.js` isn't found.

- [ ] **Step 3: Write the implementation** — `src/court/render.js`

```js
import { COURT, ZONES } from './geometry.js';
import { zoneTone } from '../heatmap.js';
import { formatStat } from '../stats.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const r4 = (n) => Number(n.toFixed(4));
const MISS_ARM = 0.2; // half-length of each stroke in the miss ×, metres

// Where each zone's stat label sits (court metres). Corner labels run vertically
// along the sideline because the corner strip is only 0.9 m wide.
export const LABEL_ANCHORS = {
  paint: [{ x: 0, y: 2.6 }],
  mid: [{ x: -4.55, y: 1.6 }, { x: 4.55, y: 1.6 }],
  corner3: [{ x: -7.05, y: 0, rotate: -90 }, { x: 7.05, y: 0, rotate: 90 }],
  wing3: [{ x: -5.6, y: 6 }, { x: 5.6, y: 6 }],
  top3: [{ x: 0, y: 9 }],
};

export function zonePaths() {
  const { halfWidth: W, baselineY: B, halfCourtY: H, paintHalfWidth: P, paintTopY: PT, threeRadius: R, cornerX: CX } = COURT;
  const a = (COURT.topAngleDeg * Math.PI) / 180;
  const by = r4(COURT.breakY);
  const ax = r4(R * Math.sin(a)); // top/wing boundary meets the arc
  const ay = r4(R * Math.cos(a));
  const hx = r4(H * Math.tan(a)); // top/wing boundary meets half-court
  const paintRect = `M ${-P} ${B} H ${P} V ${PT} H ${-P} Z`;
  return {
    paint: paintRect,
    mid: `M ${-CX} ${B} H ${CX} V ${by} A ${R} ${R} 0 0 1 ${-CX} ${by} Z ${paintRect}`,
    corner3: `M ${-W} ${B} H ${-CX} V ${by} H ${-W} Z M ${CX} ${B} H ${W} V ${by} H ${CX} Z`,
    wing3:
      `M ${CX} ${by} H ${W} V ${H} H ${hx} L ${ax} ${ay} A ${R} ${R} 0 0 0 ${CX} ${by} Z ` +
      `M ${-CX} ${by} H ${-W} V ${H} H ${-hx} L ${-ax} ${ay} A ${R} ${R} 0 0 1 ${-CX} ${by} Z`,
    top3: `M ${ax} ${ay} L ${hx} ${H} H ${-hx} L ${-ax} ${ay} A ${R} ${R} 0 0 0 ${ax} ${ay} Z`,
  };
}

export function courtLinePaths() {
  const { halfWidth: W, baselineY: B, halfCourtY: H, paintHalfWidth: P, paintTopY: PT, threeRadius: R, cornerX: CX } = COURT;
  const by = r4(COURT.breakY);
  const bb = COURT.backboardHalfWidth;
  return [
    `M ${-W} ${B} H ${W} V ${H} H ${-W} Z`, // boundary
    `M ${-P} ${B} V ${PT} H ${P} V ${B}`, // paint
    `M ${-CX} ${B} V ${by} A ${R} ${R} 0 0 0 ${CX} ${by} V ${B}`, // 3pt line
    `M ${-bb} ${COURT.backboardY} H ${bb}`, // backboard
  ];
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null && v !== '') node.setAttribute(k, String(v));
  }
  return node;
}

// Diagonal hatch = "no shots yet". Kept distinct from the neutral midpoint tone.
function noDataPattern() {
  const pattern = el('pattern', {
    id: 'no-data',
    width: 0.35,
    height: 0.35,
    patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  });
  pattern.append(
    el('rect', { width: 0.35, height: 0.35, class: 'hatch-bg' }),
    el('line', { x1: 0, y1: 0, x2: 0, y2: 0.35, class: 'hatch-line' }),
  );
  return pattern;
}

function shotMark(s) {
  if (s.made) return el('circle', { cx: s.x, cy: s.y, r: 0.2, class: 'dot made' });
  const k = MISS_ARM;
  const d = `M ${s.x - k} ${s.y - k} L ${s.x + k} ${s.y + k} M ${s.x + k} ${s.y - k} L ${s.x - k} ${s.y + k}`;
  const g = el('g', { class: 'dot miss' });
  g.append(el('path', { d, class: 'halo' }), el('path', { d, class: 'ink' }));
  return g;
}

export function createCourt(container) {
  const { halfWidth: W, baselineY: B, halfCourtY: H } = COURT;
  const svg = el('svg', {
    viewBox: `${-W} ${B} ${2 * W} ${H - B}`,
    class: 'court-svg',
    role: 'img',
    'aria-label': 'Half court. Tap where the shot was taken.',
  });
  const defs = el('defs');
  defs.append(noDataPattern());
  const zonesG = el('g', { class: 'zones' });
  const linesG = el('g', { class: 'lines' });
  const labelsG = el('g', { class: 'labels' });
  const dotsG = el('g', { class: 'dots' });
  const ghost = el('circle', { class: 'ghost', r: 0.3, visibility: 'hidden' });

  const paths = zonePaths();
  const zoneEls = {};
  const labelEls = {};
  for (const zone of ZONES) {
    zoneEls[zone] = el('path', {
      d: paths[zone],
      class: 'zone',
      'fill-rule': 'evenodd',
      'data-zone': zone,
      'data-tone': 'empty',
    });
    zonesG.append(zoneEls[zone]);
    labelEls[zone] = LABEL_ANCHORS[zone].map(({ x, y, rotate }) => {
      const text = el('text', {
        x,
        y,
        'font-size': zone === 'corner3' ? 0.4 : 0.5,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        transform: rotate ? `rotate(${rotate} ${x} ${y})` : '',
      });
      labelsG.append(text);
      return text;
    });
  }

  for (const d of courtLinePaths()) linesG.append(el('path', { d }));
  linesG.append(
    el('circle', { cx: 0, cy: COURT.paintTopY, r: COURT.ftCircleRadius }),
    el('circle', { cx: 0, cy: H, r: COURT.centerCircleRadius }),
    el('circle', { cx: 0, cy: 0, r: COURT.rimRadius }),
  );

  svg.append(defs, zonesG, linesG, labelsG, dotsG, ghost);
  container.append(svg);

  return {
    svg,
    setZones(stats) {
      for (const zone of ZONES) {
        const { tone, lowConfidence } = zoneTone(zone, stats[zone]);
        zoneEls[zone].setAttribute('data-tone', tone);
        zoneEls[zone].toggleAttribute('data-low', lowConfidence);
        for (const t of labelEls[zone]) t.textContent = formatStat(stats[zone]);
      }
    },
    setDots(shots) {
      dotsG.replaceChildren(...shots.map(shotMark));
    },
    setGhost(point) {
      if (!point) {
        ghost.setAttribute('visibility', 'hidden');
        return;
      }
      ghost.setAttribute('cx', String(point.x));
      ghost.setAttribute('cy', String(point.y));
      ghost.setAttribute('visibility', 'visible');
    },
    clientToCourt(clientX, clientY) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: NaN, y: NaN };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/court/render.js tests/render.test.js
git commit -m "feat: SVG half-court with tone-tagged zones and shape-coded shot marks"
```

---

### Task 8: Make/Miss shot picker

**Files:**
- Create: `src/ui/shotPicker.js`
- Test: `tests/shotPicker.test.js`

**Interfaces:**
- Consumes: Phosphor bold icons through Vite `?raw` imports (`@phosphor-icons/core/bold/check-bold.svg?raw`, `.../x-bold.svg?raw`). Bold files carry the `-bold` suffix, as verified in package 2.1.1.
- Produces:
  - `placePopover(tap: {x, y}, size: {width, height}, viewport: {vw, vh}, margin = 8, offset = 16): { left, top }`. Places the popover centred above the tap. If that won't fit it goes below the tap, and it is always clamped inside the viewport.
  - `createShotPicker(root = document.body): { open({clientX, clientY}, onChoose(made: boolean), onCancel()), close(), isOpen(): boolean, element }`. A full-screen transparent backdrop blocks court taps while the picker is open, and tapping the backdrop cancels. Each `open` resolves **at most once**.
- Buttons: `.make` (accent, check icon, label "Make") and `.miss` (neutral, x icon, label "Miss"). Each is at least 56 px tall (CSS, Task 9).

- [ ] **Step 1: Write the failing test** — `tests/shotPicker.test.js`

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { placePopover, createShotPicker } from '../src/ui/shotPicker.js';

const SIZE = { width: 160, height: 72 };
const PHONE = { vw: 390, vh: 844 };

// Review Focus #1: popover stays fully on screen near edges.
describe('placePopover', () => {
  it('centres above the tap when there is room', () => {
    expect(placePopover({ x: 200, y: 400 }, SIZE, PHONE)).toEqual({ left: 120, top: 312 });
  });
  it('clamps to the left edge', () => {
    expect(placePopover({ x: 10, y: 400 }, SIZE, PHONE).left).toBe(8);
  });
  it('clamps to the right edge', () => {
    expect(placePopover({ x: 385, y: 400 }, SIZE, PHONE).left).toBe(222);
  });
  it('flips below the tap near the top', () => {
    expect(placePopover({ x: 200, y: 40 }, SIZE, PHONE).top).toBe(56);
  });
  it('clamps vertically in a very short viewport', () => {
    expect(placePopover({ x: 200, y: 30 }, SIZE, { vw: 390, vh: 100 }).top).toBe(20);
  });
});

describe('createShotPicker', () => {
  let picker;
  let onChoose;
  let onCancel;
  const button = (name) => picker.element.querySelector(`.${name}`);

  beforeEach(() => {
    document.body.innerHTML = '';
    picker = createShotPicker(document.body);
    onChoose = vi.fn();
    onCancel = vi.fn();
  });

  it('is hidden until opened', () => {
    expect(picker.element.hidden).toBe(true);
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    expect(picker.element.hidden).toBe(false);
    expect(picker.isOpen()).toBe(true);
  });

  it('labels buttons with text plus a decorative icon', () => {
    expect(button('make').textContent.trim()).toBe('Make');
    expect(button('miss').textContent.trim()).toBe('Miss');
    expect(button('make').querySelector('.icon[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('reports Make as true and closes', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    button('make').click();
    expect(onChoose).toHaveBeenCalledWith(true);
    expect(picker.isOpen()).toBe(false);
    expect(picker.element.hidden).toBe(true);
  });

  it('reports Miss as false', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    button('miss').click();
    expect(onChoose).toHaveBeenCalledWith(false);
  });

  // Review Focus #2: a double-tap logs exactly one shot.
  it('resolves only once on a rapid double tap', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    button('make').click();
    button('make').click();
    button('miss').click();
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('cancels when the backdrop is tapped', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    picker.element.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(picker.isOpen()).toBe(false);
  });

  it('cancels the previous shot if reopened', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    const second = vi.fn();
    picker.open({ clientX: 50, clientY: 50 }, second, vi.fn());
    expect(onCancel).toHaveBeenCalledTimes(1);
    button('make').click();
    expect(second).toHaveBeenCalledWith(true);
    expect(onChoose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shotPicker.test.js`
Expected: FAIL, `src/ui/shotPicker.js` isn't found.

- [ ] **Step 3: Write the implementation** — `src/ui/shotPicker.js`

```js
import checkIcon from '@phosphor-icons/core/bold/check-bold.svg?raw';
import xIcon from '@phosphor-icons/core/bold/x-bold.svg?raw';

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), Math.max(lo, hi));

export function placePopover(tap, size, viewport, margin = 8, offset = 16) {
  const left = clamp(tap.x - size.width / 2, margin, viewport.vw - size.width - margin);
  let top = tap.y - size.height - offset;
  if (top < margin) top = tap.y + offset;
  top = clamp(top, margin, viewport.vh - size.height - margin);
  return { left, top };
}

function makeButton(label, className, icon) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.innerHTML = `<span class="icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
  return b;
}

export function createShotPicker(root = document.body) {
  const backdrop = document.createElement('div');
  backdrop.className = 'picker-backdrop';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Log shot');
  const make = makeButton('Make', 'make', checkIcon);
  const miss = makeButton('Miss', 'miss', xIcon);
  panel.append(make, miss);
  backdrop.append(panel);
  root.append(backdrop);

  let handlers = null;

  // Clearing handlers before calling out guarantees one resolution per open.
  function finish(kind, arg) {
    if (!handlers) return;
    const h = handlers;
    handlers = null;
    backdrop.hidden = true;
    if (kind === 'choose') h.onChoose(arg);
    else h.onCancel?.();
  }

  make.addEventListener('click', () => finish('choose', true));
  miss.addEventListener('click', () => finish('choose', false));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) finish('cancel');
  });

  return {
    element: backdrop,
    open({ clientX, clientY }, onChoose, onCancel) {
      finish('cancel');
      handlers = { onChoose, onCancel };
      backdrop.hidden = false;
      const rect = panel.getBoundingClientRect();
      const { left, top } = placePopover(
        { x: clientX, y: clientY },
        { width: rect.width, height: rect.height },
        { vw: window.innerWidth, vh: window.innerHeight },
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    },
    close() {
      finish('cancel');
    },
    isOpen: () => handlers !== null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shotPicker.test.js`
Expected: PASS. If Vitest cannot resolve the `?raw` import, check `node_modules/@phosphor-icons/core/package.json` `exports` for `./bold/*.svg` and log the result in `task_plan.md` Errors. Do not hand-draw icons as a fallback.

- [ ] **Step 5: Commit**

```bash
git add src/ui/shotPicker.js tests/shotPicker.test.js
git commit -m "feat: Make/Miss picker with edge-safe placement and single resolution"
```

---

### Task 9: Controls, page shell, styling, wiring, and verification

**Files:**
- Create: `src/ui/controls.js`, `index.html`, `src/style.css`, `src/main.js`
- Test: `tests/controls.test.js`

**Interfaces:**
- Consumes: everything above. `createControls` reads the element ids defined in `index.html`.
- Produces: `BANNER_TEXT`, `formatDate(ts): string`, `createControls(doc, { onNewSession, onUndo, onViewChange, onDismissBanner }): { update(snapshot) }`. `update` also shows the empty-state hint (`#hint`) only while viewing an empty current session.

- [ ] **Step 1: Write the failing test** — `tests/controls.test.js`

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createControls, formatDate, BANNER_TEXT } from '../src/ui/controls.js';

const T0 = 1_760_000_000_000;
const SHELL = `
  <span id="session-date"></span><button id="new-session"></button>
  <div id="banner" hidden><span id="banner-text"></span><button id="banner-dismiss"></button></div>
  <div id="totals"></div>
  <button data-view="current" aria-pressed="true"></button>
  <button data-view="all" aria-pressed="false"></button>
  <p id="hint" hidden></p>
  <button id="undo"></button>`;

const snapshot = (over = {}) => ({
  view: 'current',
  warning: null,
  session: { id: 's', startedAt: T0, shots: [] },
  shots: [],
  totals: { made: 0, attempts: 0, pct: null },
  canUndo: false,
  ...over,
});

describe('createControls', () => {
  let handlers;
  let controls;
  const $ = (sel) => document.querySelector(sel);

  beforeEach(() => {
    document.body.innerHTML = SHELL;
    handlers = { onNewSession: vi.fn(), onUndo: vi.fn(), onViewChange: vi.fn(), onDismissBanner: vi.fn() };
    controls = createControls(document, handlers);
  });

  it('renders date, totals, view and undo state', () => {
    controls.update(
      snapshot({ view: 'all', shots: [{}], totals: { made: 7, attempts: 12, pct: 58 }, canUndo: true }),
    );
    expect($('#session-date').textContent).toBe(formatDate(T0));
    expect($('#totals').textContent).toBe('7/12 · 58%');
    expect($('[data-view="all"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-view="current"]').getAttribute('aria-pressed')).toBe('false');
    expect($('#undo').disabled).toBe(false);
  });

  it('disables undo when there is nothing to undo', () => {
    controls.update(snapshot());
    expect($('#undo').disabled).toBe(true);
  });

  it('shows the empty-state hint only for an empty current session', () => {
    controls.update(snapshot());
    expect($('#hint').hidden).toBe(false);
    controls.update(snapshot({ shots: [{}] }));
    expect($('#hint').hidden).toBe(true);
    controls.update(snapshot({ view: 'all' }));
    expect($('#hint').hidden).toBe(true);
  });

  it('shows and hides the banner', () => {
    controls.update(snapshot({ warning: 'unavailable' }));
    expect($('#banner').hidden).toBe(false);
    expect($('#banner-text').textContent).toBe(BANNER_TEXT.unavailable);
    controls.update(snapshot());
    expect($('#banner').hidden).toBe(true);
  });

  it('uses plain punctuation in user-facing copy (no em or en dashes)', () => {
    for (const text of Object.values(BANNER_TEXT)) expect(text).not.toMatch(/[–—]/);
  });

  it('forwards clicks to handlers', () => {
    $('#new-session').click();
    $('#undo').click();
    $('[data-view="all"]').click();
    $('#banner-dismiss').click();
    expect(handlers.onNewSession).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onViewChange).toHaveBeenCalledWith('all');
    expect(handlers.onDismissBanner).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/controls.test.js`
Expected: FAIL, `src/ui/controls.js` isn't found.

- [ ] **Step 3: Write the implementation** — `src/ui/controls.js`

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/controls.test.js`
Expected: PASS.

- [ ] **Step 5: Write the page shell** — `index.html`

Icons are placeholders (`<span class="icon">`) that `main.js` fills with Phosphor SVGs. The legend is required by dataviz: a scale for the diverging tones, a key for the make/miss shapes, and the "no shots" hatch.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f4f4f5" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
    <title>Shot Tracker</title>
  </head>
  <body>
    <div id="app">
      <header class="bar">
        <h1 class="title">Session <span id="session-date"></span></h1>
        <button id="new-session" type="button"><span class="icon" data-icon="plus" aria-hidden="true"></span>New session</button>
      </header>

      <div id="banner" class="banner" role="status" hidden>
        <span class="icon" data-icon="warning" aria-hidden="true"></span>
        <span id="banner-text"></span>
        <button id="banner-dismiss" type="button" aria-label="Dismiss"><span class="icon" data-icon="x" aria-hidden="true"></span></button>
      </div>

      <section class="bar">
        <div id="totals" class="stat" aria-live="polite">0/0</div>
        <div class="toggle" role="group" aria-label="Stats range">
          <button type="button" data-view="current" aria-pressed="true">This session</button>
          <button type="button" data-view="all" aria-pressed="false">All time</button>
        </div>
      </section>

      <main id="court" class="court">
        <p id="hint" class="hint" hidden>Tap where you shot from</p>
      </main>

      <figure class="legend" aria-label="Heatmap key">
        <div class="scale">
          <span>Cold</span>
          <span class="swatches" aria-hidden="true">
            <i data-tone="c3"></i><i data-tone="c2"></i><i data-tone="c1"></i><i data-tone="n"></i><i data-tone="h1"></i><i data-tone="h2"></i><i data-tone="h3"></i>
          </span>
          <span>Hot</span>
        </div>
        <div class="marks">
          <span><svg class="mark-key" viewBox="-0.3 -0.3 0.6 0.6" aria-hidden="true"><circle class="dot made" r="0.2" /></svg>Make</span>
          <span><svg class="mark-key" viewBox="-0.3 -0.3 0.6 0.6" aria-hidden="true"><g class="dot miss"><path class="halo" d="M -0.2 -0.2 L 0.2 0.2 M 0.2 -0.2 L -0.2 0.2" /><path class="ink" d="M -0.2 -0.2 L 0.2 0.2 M 0.2 -0.2 L -0.2 0.2" /></g></svg>Miss</span>
          <span><i class="swatch-empty" aria-hidden="true"></i>No shots</span>
        </div>
        <figcaption>Each zone is compared with a typical FG% for that shot. Faded zones have fewer than 3 shots.</figcaption>
      </figure>

      <footer class="bar bottom">
        <button id="undo" type="button" disabled><span class="icon" data-icon="undo" aria-hidden="true"></span>Undo</button>
      </footer>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Write the styles** — `src/style.css`

Token values are fixed by Global Constraints (heat) and the contrast check recorded in `findings.md` (UI pairs: every one at least 4.99:1). Z-index scale: one layer, `10` = picker overlay.

```css
/* Tokens. Light is the default; dark is a separately chosen set, not an inversion. */
:root {
  color-scheme: light;
  --font-sans: 'Geist Variable', system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, monospace;
  --radius: 12px;

  --bg: #f4f4f5;
  --surface: #fcfcfb;
  --surface-2: #e4e4e7;
  --text: #18181b;
  --text-2: #52525b;
  --border: #d4d4d8;
  --accent: #047857;
  --on-accent: #fcfcfb;
  --warn-bg: #fef3c7;
  --warn-text: #78350f;
  --shadow: 0 12px 32px rgb(24 24 27 / 0.18);

  --court-floor: #e4e4e7;
  --court-line: #3f3f46;
  --hatch: #a1a1aa;

  --heat-c3: #1c5cab;
  --heat-c2: #5598e7;
  --heat-c1: #9ec5f4;
  --heat-n: #f0efec;
  --heat-h1: #f3ada7;
  --heat-h2: #e06e68;
  --heat-h3: #a1302f;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #09090b;
    --surface: #18181b;
    --surface-2: #27272a;
    --text: #fafafa;
    --text-2: #a1a1aa;
    --border: #3f3f46;
    --accent: #10b981;
    --on-accent: #052e16;
    --warn-bg: #422006;
    --warn-text: #fde68a;
    --shadow: 0 12px 32px rgb(9 9 11 / 0.6);

    --court-floor: #27272a;
    --court-line: #d4d4d8;
    --hatch: #52525b;

    --heat-c3: #5598e7;
    --heat-c2: #2a78d6;
    --heat-c1: #1c5cab;
    --heat-n: #383835;
    --heat-h1: #a1302f;
    --heat-h2: #ca4442;
    --heat-h3: #e06e68;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font: 16px/1.4 var(--font-sans);
  -webkit-tap-highlight-color: transparent;
}

#app {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100dvh;
  max-width: 560px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 10px) 16px calc(env(safe-area-inset-bottom) + 12px);
}
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
.title span { color: var(--text-2); font-weight: 500; }
.stat {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* Controls: one 12px radius everywhere. */
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-weight: 600;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 44px;
  padding: 0 14px;
  white-space: nowrap;
  touch-action: manipulation;
  cursor: pointer;
}
button:disabled { opacity: 0.4; cursor: default; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.icon { display: inline-flex; }
.icon svg { width: 20px; height: 20px; fill: currentColor; }

.toggle { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.toggle button { border: 0; border-radius: 0; min-height: 42px; font-weight: 500; color: var(--text-2); }
.toggle button[aria-pressed='true'] { background: var(--text); color: var(--bg); font-weight: 600; }

.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border-radius: var(--radius);
  background: var(--warn-bg);
  color: var(--warn-text);
  font-size: 14px;
}
.banner[hidden] { display: none; }
#banner-text { flex: 1; }
.banner button { min-height: 36px; padding: 0 8px; background: transparent; border: 0; color: inherit; }

/* Court */
.court { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.court-svg { width: 100%; max-height: 100%; touch-action: manipulation; }
.hint {
  position: absolute;
  left: 50%;
  bottom: 14%;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-2);
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
}
.hint[hidden] { display: none; }

[data-tone='c3'] { --tone: var(--heat-c3); }
[data-tone='c2'] { --tone: var(--heat-c2); }
[data-tone='c1'] { --tone: var(--heat-c1); }
[data-tone='n'] { --tone: var(--heat-n); }
[data-tone='h1'] { --tone: var(--heat-h1); }
[data-tone='h2'] { --tone: var(--heat-h2); }
[data-tone='h3'] { --tone: var(--heat-h3); }
.zone { fill: var(--tone, var(--court-floor)); }
.zone[data-tone='empty'] { fill: url(#no-data); }
.zone[data-low] { fill-opacity: 0.35; }
.hatch-bg { fill: var(--court-floor); }
.hatch-line { stroke: var(--hatch); stroke-width: 0.05; }

.lines * { fill: none; stroke: var(--court-line); stroke-width: 0.06; pointer-events: none; }
.labels text {
  font-family: var(--font-mono);
  font-weight: 600;
  fill: var(--text);
  stroke: var(--surface);
  stroke-width: 0.12;
  stroke-linejoin: round;
  paint-order: stroke;
  pointer-events: none;
  user-select: none;
}

/* Shot marks: shape carries make/miss, ink + 2px surface halo keeps them legible on any tone. */
.dot { pointer-events: none; }
.dot.made { fill: var(--text); stroke: var(--surface); stroke-width: 0.08; }
.dot.miss path { fill: none; stroke-linecap: round; }
.dot.miss .halo { stroke: var(--surface); stroke-width: 0.2; }
.dot.miss .ink { stroke: var(--text); stroke-width: 0.08; }
.ghost { fill: none; stroke: var(--text); stroke-width: 0.06; stroke-dasharray: 0.12 0.08; pointer-events: none; }

/* Legend */
.legend { margin: 0; display: grid; gap: 6px; font-size: 13px; color: var(--text-2); }
.scale, .marks { display: flex; align-items: center; gap: 8px; }
.marks { gap: 16px; }
.marks > span { display: inline-flex; align-items: center; gap: 6px; }
.swatches { display: flex; flex: 1; gap: 2px; }
.swatches i { flex: 1; height: 10px; background: var(--tone); }
.swatches i:first-child { border-radius: 4px 0 0 4px; }
.swatches i:last-child { border-radius: 0 4px 4px 0; }
.mark-key { width: 14px; height: 14px; }
.swatch-empty {
  width: 16px;
  height: 10px;
  border-radius: 2px;
  background: repeating-linear-gradient(45deg, var(--hatch) 0 1px, var(--court-floor) 1px 4px);
}
.legend figcaption { font-size: 12px; }

.bottom { justify-content: center; }
#undo { min-width: 168px; min-height: 56px; }

/* Picker overlay (z-index 10 is the only layer in the app). */
.picker-backdrop { position: fixed; inset: 0; z-index: 10; }
.picker-backdrop[hidden] { display: none; }
.picker {
  position: fixed;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.picker button { min-width: 112px; min-height: 56px; font-size: 17px; }
.picker .make { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.picker .miss { background: var(--surface-2); }

/* Motion: feedback only, transform/opacity only, and none at all under reduced motion. */
@media (prefers-reduced-motion: no-preference) {
  button { transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1); }
  button:active:not(:disabled) { transform: scale(0.98); }
  .picker { animation: picker-in 140ms cubic-bezier(0.16, 1, 0.3, 1); }
}
@keyframes picker-in {
  from { opacity: 0; transform: scale(0.96); }
}
```

- [ ] **Step 7: Write the wiring** — `src/main.js`

```js
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
```

- [ ] **Step 8: Run the full suite, the build, and the copy check**

Run: `npm test`
Expected: all test files PASS.

Run: `npm run build`
Expected: `dist/` is built and Vite prints no errors. The font files and inlined icons appear in the build output.

Run: `grep -rnP "[\x{2013}\x{2014}]" index.html src` (taste rule: zero em and en dashes in visible copy)
Expected: no output.

- [ ] **Step 9: Manual verification at 390×844, both colour schemes**

Run `npm run dev` (in the background), then open the printed URL in a browser (Playwright MCP is fine) with the viewport at 390×844. Take a screenshot in light mode and another in emulated dark mode (`prefers-color-scheme: dark`). Check each item and record the results in `progress.md`:
1. Tap the paint, mid, a corner, a wing and the top. In each case the ghost dot appears, Make/Miss stays fully on screen, and the shot lands in the right zone label.
2. Tap a corner hard against the sideline. The popover stays fully visible.
3. Tap the backdrop while the picker is open. Nothing is logged and the ghost disappears.
4. Undo removes the last mark. Undo is disabled once the session is empty, and the "Tap where you shot from" hint returns.
5. In one zone, 1 to 2 shots look faded and 3 or more look full. An empty zone is hatched, not grey.
6. Make dots and miss crosses stay readable on the darkest blue and darkest red zones in **both** themes. Zone labels stay readable on every tone in both themes.
7. Switch to All time: marks are hidden and stats include earlier sessions. Switch to This session: marks return.
8. New session with shots asks for confirmation and then starts empty. With no shots it does nothing.
9. Reload the page and confirm all data persists.
10. In DevTools, run `localStorage.setItem('shot-tracker:v1','{bad')` and reload. The banner appears with its warning icon and a `shot-tracker:corrupt-*` key exists.
11. With reduced motion emulated, the picker appears without animation and buttons don't scale on press.
12. The header, totals, toggle, legend and Undo all fit without horizontal scroll, and no button label wraps.

- [ ] **Step 10: Commit**

```bash
git add index.html src/main.js src/style.css src/ui/controls.js tests/controls.test.js
git commit -m "feat: page shell, styling, controls, and app wiring"
```
