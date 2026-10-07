# Shot Tracker — Design

Date: 2026-10-07
Status: Approved (brainstorming)

## Purpose

A phone-first web app for logging **my own** basketball shooting workouts at the gym.
Tap where a shot was taken on a half-court, mark it make/miss, and see FG% by zone as a
heatmap. Single user, single device, no accounts or sync.

**Success:** logging a shot takes two taps with a sweaty thumb; the heatmap answers
"how am I shooting today?" and "where am I weak overall?"; data survives reloads.

## Constraints

- Vanilla JS + Vite, no UI framework. Vitest for tests. Runtime assets: self-hosted Geist / Geist Mono
  (Fontsource) and Phosphor icon SVGs (`@phosphor-icons/core`).
- Persistence: `localStorage` only.
- Court: **FIBA** dimensions (metres).
- Primary viewport: portrait phone (~390×844), touch input.

## Scope

In:
- Tap court → Make/Miss popover → shot logged (with x/y, zone, timestamp).
- Undo last shot (current session).
- Sessions: one current session; "New session" starts another.
- Heatmap of FG% over 5 zones: paint, mid-range, corner 3, wing 3, top 3
  (left/right combined). Toggle **Current session / All-time**.
- Per-zone label "made/attempts · pct%"; session totals bar.

Out (YAGNI): export, trends/charts over time, session history list, PWA/offline install,
left/right zone split, multiple players.

## Architecture

Rendering: **inline SVG**. Zone hit-testing is **geometric** (pure function on court
coordinates), not DOM-based.

```
index.html
src/
  main.js             wires state → render; single app state object
  court/geometry.js   pure: FIBA constants, classifyZone(x, y) → zone id | null
  court/render.js     builds SVG court + zone paths, draws shot dots, applies heatmap fills
  stats.js            pure: shots[] → { [zone]: { made, attempts, pct } } + totals
  heatmap.js          pure: (zone, {made, attempts}) → { tone, lowConfidence }
  store.js            localStorage load/save, versioned schema, session operations
  ui/shotPicker.js    Make/Miss popover positioned at tap point
  ui/controls.js      header/totals, Current/All toggle, New session, Undo, banners
  style.css
tests/                Vitest unit tests for geometry, stats, heatmap, store
```

Data flow: user action → pure state update → `store.save(state)` → `render(state)`.

### Data model

```js
{
  version: 1,
  currentSessionId: "s_…",
  sessions: [
    { id: "s_…", startedAt: 1759850000000,
      shots: [ { x: 1.2, y: 4.0, made: true, zone: "paint", t: 1759850012345 } ] }
  ]
}
```

Stored under the single key `shot-tracker:v1`.

## Court geometry (FIBA, metres)

Coordinate system: origin at **basket centre**; +x toward the right sideline; +y away
from the baseline toward half-court. Baseline is at y = −1.575.

| Constant | Value |
|---|---|
| Half-court width | 15.0 (x ∈ [−7.5, 7.5]) |
| Half-court depth | 14.0 (y ∈ [−1.575, 12.425]) |
| Paint | 4.9 wide (\|x\| ≤ 2.45), baseline to 5.8 m from baseline (y ≤ 4.225) |
| 3pt arc radius | 6.75 from basket centre |
| 3pt corner lines | \|x\| = 6.6, from baseline up to where they meet the arc |
| Corner/arc break | y = √(6.75² − 6.6²) ≈ 1.415 (≈ 2.99 m from baseline) |

### `classifyZone(x, y)`

1. Outside half-court bounds → `null` (tap ignored).
2. Three-pointer if `|x| > 6.6` (when `y ≤ 1.415`) or `√(x²+y²) > 6.75` (when `y > 1.415`).
   A shot exactly on the line is **two points**.
3. Three-pointers:
   - `y ≤ 1.415` → `corner3`
   - else angle from straight-on `|atan2(x, y)| ≤ 22.5°` → `top3`, otherwise `wing3`
4. Two-pointers: `|x| ≤ 2.45` and `y ≤ 4.225` → `paint`; otherwise `mid`.

Zone ids: `paint`, `mid`, `corner3`, `wing3`, `top3`.

## UI

Single screen, portrait:

- **Header:** "Session <date>" + **New session** button.
- **Totals bar:** `made/attempts · pct%` (mono) + **This session | All time** segmented toggle.
- **Court:** SVG half-court, basket at top, zones tinted by heatmap, zone labels.
  Empty current session shows a hint: "Tap where you shot from".
- **Legend:** Cold to Hot tone scale, Make/Miss mark key, "No shots" hatch, one-line caption.
- **Bottom bar:** **Undo** (thumb reach).

Interactions:
- Tap court → ghost dot at tap point + popover with **Make** / **Miss** buttons
  (Phosphor check / x icons, ≥ 56 px), clamped on-screen. Choosing records the shot;
  tapping elsewhere cancels.
- Taps outside the court (`classifyZone` → null) are ignored.
- Shot marks are shape-coded, not colour-coded (red/green would collide with the heatmap):
  made = filled ink dot, missed = ink ×, both with a surface-coloured halo. Hidden in All-time mode.
- Undo removes the latest shot of the current session; disabled when empty.
- New session: confirm only if the current session has shots; an empty current session
  is reused rather than creating another.
- Shot logging is always into the current session (also allowed while viewing All-time).

### Heatmap colour

Per-zone fill on a **diverging blue↔red scale with a neutral grey midpoint**, binned into 7 tones
(`c3 c2 c1 n h1 h2 h3`), positioned between anchors:

| Zone type | Cold at | Hot at |
|---|---|---|
| 2pt (paint, mid) | ≤ 30% | ≥ 60% |
| 3pt (corner3, wing3, top3) | ≤ 20% | ≥ 45% |

- 0 attempts → diagonal hatch (so "no data" never reads as "average").
- 1–2 attempts → tone at 35% fill-opacity (low confidence).
- ≥ 3 attempts → full opacity.
- Tone colours are CSS tokens with separately chosen light and dark steps (values in the plan's
  Global Constraints). Lightness changes steadily on each side and the two sides mirror; the
  poles' colourblind ΔE is ≈ 19.

## Visual design

Design read: a single-screen phone utility for a solo player mid-workout, with a sporty-utilitarian,
high-contrast look, built on native CSS tokens + Geist/Geist Mono + Phosphor icons.
Dials: variance 3, motion 3, density 5.

- Zinc neutrals; one accent (emerald) for the Make button and focus rings only.
- One 12 px radius for all controls and panels.
- Light and dark themes follow `prefers-color-scheme`; every UI text pair is ≥ 4.5:1.
- Motion is feedback only (button press, popover entrance) and disabled under reduced motion.
- Copy: no em/en dashes, no emoji or glyph icons.

## Persistence & error handling

- `load()`: read key → parse → validate shape → `migrate(data)` → recompute each shot's
  `zone` from x/y (geometry is the source of truth).
- Corrupt/unparseable data: copy raw string to `shot-tracker:corrupt-<timestamp>`, start
  fresh, show a dismissible banner.
- `save()` failure (quota, private mode, storage disabled): keep running in memory, show
  "Not saving — storage unavailable" banner. Never throw to the UI.
- No saved data: create a first session.

## Testing

Vitest, test-first, for pure modules:
- **geometry:** paint edges, point exactly on the arc, corner/arc break at y≈1.415,
  22.5° top/wing boundary, out-of-bounds, on-the-line = two.
- **stats:** empty, single zone, all zones, pct rounding, totals.
- **heatmap:** anchor clamping for 2pt vs 3pt, tone bins, low-confidence rule, empty = hatch.
- **store:** save/load round-trip, corrupt-data backup + recovery, in-memory fallback
  when `setItem` throws, empty-session reuse, undo.

Manual: 390×844 viewport — log shots in every zone, undo, toggle, reload.
