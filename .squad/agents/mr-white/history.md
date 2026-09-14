# Project Context

- **Owner:** Mateus Perdigão
- **Project:** ABI Trainer — a browser-based inventory packing game inspired by Arena Breakout Infinite. Players start a run, receive a bag and a set of items, and try to fit as much value as possible into the available space.
- **Stack:** TBD (likely web frontend, e.g. HTML5 canvas/TypeScript) — to be confirmed with the team.
- **Created:** 2026-09-11

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-09-12T01:20:00-03:00): Training mode now exposes storage-unit-centric selectors and validate helpers, and the React layer is wired onto that real state contract instead of a parallel inventory model. — decided by Mr. Pink, Mr. Orange
📌 Team update (2026-09-12T01:20:00-03:00): Core-loop coverage now includes the end-to-end loot -> extract -> score path and should stay deterministic with fake timers plus explicit loot fixtures. — decided by Mr. Blue
