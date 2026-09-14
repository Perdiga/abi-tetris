# Project Context

- **Owner:** Mateus Perdigão
- **Project:** ABI Trainer — a browser-based inventory packing game inspired by Arena Breakout Infinite. Players start a run, receive a bag and a set of items, and try to fit as much value as possible into the available space.
- **Stack:** TBD (likely web frontend, e.g. HTML5 canvas/TypeScript) — to be confirmed with the team.
- **Created:** 2026-09-11

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-09-12T01:20:00-03:00): The core loop now runs on one gameplay contract: `src/data` + `src/engine` + `src/state` are the source of truth, and the UI dispatches engine-backed actions through selector view models. — decided by Mr. White, Mr. Pink, Mr. Orange
📌 Team update (2026-09-12T01:20:00-03:00): Deterministic fixtures and fake timers are now the testing contract for timing, loot, extraction, and scoring regressions across the training-mode flow. — decided by Mr. Blue
📌 Team update (2026-09-12T02:15:00.000-03:00): Ground loot assertions should target the unified `ground-loot-grid` stash view rather than per-source wrappers because loose and nested loot now render in one flattened tile grid. — decided by Mr. Orange
