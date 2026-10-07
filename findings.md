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
