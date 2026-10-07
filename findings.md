# Findings

## Tooling (Context7, 2026-10-07)

- **Vite** (`/vitejs/vite`): requires Node 20.19+ or 22.12+. create-vite still has a `vanilla` template
  (`npm create vite@latest <dir> -- --template vanilla`; `.` means the current directory).
- **Vitest** (`/vitest-dev/vitest`): configure inside `vite.config.js` with a `test` block and
  `/// <reference types="vitest/config" />`. `environment` can be `node`, `jsdom` or `happy-dom`. jsdom must
  be installed separately (`npm i -D jsdom`). Individual files can opt in with a `// @vitest-environment jsdom` docblock.
- Local machine: Node v24.18.0, npm 11.16.0.
- Installed versions: record here after `npm install` in Task 1.

## Court geometry (FIBA, metres)

- Basket centre is 1.575 m from the baseline. Half-court is 15 m wide and 14 m deep.
- Paint is 4.9 m wide and 5.8 m deep from the baseline (top at y = 4.225 when the origin is the basket).
- 3pt arc radius is 6.75. Corner lines sit 6.6 m from centre and meet the arc at y = √(6.75² − 6.6²) ≈ 1.415,
  which is 2.99 m from the baseline and matches the published FIBA figure.
- The top/wing boundary at 22.5° meets the arc at (±2.583, 6.236) and the half-court line at x = ±5.147.
- Label anchors were chosen to sit inside their own zones (this is checked by a test in render.test.js).

## Visual design (design-taste-frontend + dataviz, 2026-10-07)

- Design read: a single-screen phone utility for a solo player mid-workout, with a sporty-utilitarian, high-contrast look.
  Dials: variance 3, motion 3, density 5. design-taste-frontend targets landing pages, so only its colour, type,
  shape, contrast, motion, icon and copy rules were applied.
- dataviz flagged the original blue→yellow→red scale (a hue at the midpoint is an anti-pattern) and the grey empty
  fill (it collides with a neutral midpoint). Replacement: a diverging blue↔red scale with 7 bins and a grey midpoint;
  empty = hatch.
- Ramp built in OKLCH from the dataviz blue steps, with red at matched lightness (hue taken from #e34948):
  - light L: 0.480 0.671 0.812 0.952 0.812 0.671 0.480 (steady on each side, mirrored)
  - dark  L: 0.671 0.575 0.480 0.340 0.480 0.575 0.671
  - Poles' colourblind ΔE: 19.9 light / 18.7 dark (PASS). The dark "lightness band" FAIL is a categorical-only
    check (L 0.671 vs 0.67 max) and doesn't apply to diverging ramps.
- Make/miss marks were moved from red/green colour to shape (dot vs ×) because red/green would collide with the
  heat tones.
- UI contrast (WCAG): every text pair ≥ 5.3:1. Focus ring vs background is 4.99 (light) / 7.84 (dark), and court
  lines vs floor are 8.2 / 10.1.
- Packages verified: @fontsource-variable/geist 5.3.0, @fontsource-variable/geist-mono 5.3.0,
  @phosphor-icons/core 2.1.1. **Bold icon files have a `-bold` suffix** (`bold/check-bold.svg`) and are exported
  as `./bold/*.svg`.
