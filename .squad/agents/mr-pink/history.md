# Project Context

- **Owner:** Mateus Perdigão
- **Project:** ABI Trainer — a browser-based inventory packing game inspired by Arena Breakout Infinite. Players start a run, receive a bag and a set of items, and try to fit as much value as possible into the available space.
- **Stack:** TBD (likely web frontend, e.g. HTML5 canvas/TypeScript) — to be confirmed with the team.
- **Created:** 2026-09-11

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-09-12T01:20:00-03:00): The browser layer now owns reducer/tick orchestration only; gameplay legality, storage geometry, loot persistence, scoring, and state transitions remain in engine-backed selectors and actions. — decided by Mr. Orange, Mr. White
📌 Team update (2026-09-12T01:20:00-03:00): Test coverage now spans the full packing loop and relies on deterministic timer and loot fixtures, so state changes should preserve repeatable timing and extraction behavior. — decided by Mr. Blue

📌 Team update (2026-09-12T04:30:00-03:00): Real compile/test/build/lint runs in the dev container caught state-layer issues static review missed — verify reducer overloads, exported contract types, action discriminants, and score math against container-backed `tsc`/`vitest` when possible. — decided by Squad Coordinator
📌 Team update (2026-09-12T02:15:00.000-03:00): Ground loot now renders as one flattened ABI-style stash grid across all active loot sources, including nested container contents, while preserving engine/state ownership of the underlying loot data contract. — decided by Mr. Orange
