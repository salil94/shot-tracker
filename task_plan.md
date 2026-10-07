# Task Plan: Shot Tracker (vanilla JS + Vite)

## Goal

Ship a phone-first web app that logs basketball shots on a FIBA half-court (tap → Make/Miss), shows FG% by zone (paint, mid, corner 3, wing 3, top 3) as a heatmap for the current session or all-time, and saves sessions to localStorage.

## Next Step

Wait for the user to review `docs/superpowers/plans/2026-10-07-shot-tracker.md`, then start Phase 1 (Task 1: project setup + geometry).

## Current Phase

Phase 0 (awaiting plan review)

## Source Documents

- Spec: `docs/superpowers/specs/2026-10-07-shot-tracker-design.md`
- Detailed plan (code + tests per step): `docs/superpowers/plans/2026-10-07-shot-tracker.md`
- Execution: inline, as the user requested (superpowers:executing-plans, no subagents), test-first.

## Phases

### Phase 0: Design & Plan

- [x] Brainstorm and approve the design (sections 1–3, FIBA dimensions)
- [x] Write the spec
- [x] Context7 lookups for Vite and Vitest setup (see findings.md)
- [x] Write the detailed implementation plan
- [ ] User reviews the plan
- **Status:** in_progress

### Phase 1: Foundation (plan Tasks 1–3)

- [ ] Task 1: package.json, vite.config.js, .gitignore, install vite/vitest/jsdom, `court/geometry.js` (TDD)
- [ ] Task 2: `stats.js` (TDD)
- [ ] Task 3: `heatmap.js` (TDD)
- **Status:** pending

### Phase 2: State & Persistence (plan Tasks 4–6)

- [ ] Task 4: `state.js` pure session ops (TDD)
- [ ] Task 5: `store.js` load/save/migrate/corrupt recovery (TDD)
- [ ] Task 6: `app.js` controller with immediate persistence (TDD)
- **Status:** pending

### Phase 3: UI (plan Tasks 7–8)

- [ ] Task 7: `court/render.js` SVG court, zones, labels, dots (TDD, jsdom)
- [ ] Task 8: `ui/shotPicker.js` placement + single-resolution picker (TDD, jsdom)
- **Status:** pending

### Phase 4: Shell, Wiring & Verification (plan Task 9)

- [ ] `ui/controls.js` (TDD, jsdom), `index.html`, `style.css`, `main.js`
- [ ] `npm test` all green, `npm run build` clean
- [ ] Manual check at 390×844 (9-item checklist in plan Task 9 Step 9), with results logged in progress.md
- **Status:** pending

## Key Questions

1. ~~Who is it for?~~ The user's own workouts, logged on a phone at the gym.
2. ~~How is a shot logged?~~ Tap the spot, then the Make/Miss popover. Undo is included.
3. ~~What does the heatmap show?~~ The current session, with an All-time toggle.
4. ~~Should left and right be split?~~ No: 5 combined zones, with x/y stored.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Inline SVG, viewBox in court metres | Each zone is its own element and scales cleanly; no coordinate transform needed |
| Geometric `classifyZone` (not DOM hit-testing) | Pure and testable; stored shots can be reclassified |
| FIBA dimensions | The user plays on FIBA courts |
| Split `state.js` (pure) from `store.js` (I/O) | Pure ops can be tested without fake storage |
| `app.js` controller between state and DOM | Persistence on every mutation is testable in Node |
| Storage passed in as a parameter (`load(storage, now)`) | Lets tests simulate quota, private mode and missing storage |
| Hand-written scaffold instead of `create-vite` | The repo already has `docs/`, and create-vite prompts when a folder isn't empty |
| jsdom per file via `// @vitest-environment jsdom` | Pure modules stay on the fast Node environment |
| Full-screen backdrop behind the picker | A tap outside cancels without starting a new shot |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
|       |         |            |
