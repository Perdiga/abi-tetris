# Project Context

- **Owner:** Mateus Perdigão
- **Project:** ABI Trainer — a browser-based inventory packing game inspired by Arena Breakout Infinite. Players start a run, receive a bag and a set of items, and try to fit as much value as possible into the available space.
- **Stack:** TBD (likely web frontend, e.g. HTML5 canvas/TypeScript) — to be confirmed with the team.
- **Created:** 2026-09-11

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-09-12T01:20:00-03:00): UI components must stay thin: render selector-built storage and loot view models, traverse nested containers by `containerStorageUnitId`, and dispatch only validated engine-backed actions. — decided by Mr. White, Mr. Pink
📌 Team update (2026-09-12T01:20:00-03:00): The training loop is now wired end-to-end from start -> pack -> loot -> extract/timeout -> results, and tests cover the loot -> extract -> score path with deterministic fixtures. — decided by Mr. Blue, Mr. Orange

📌 Team update (2026-09-12T04:30:00-03:00): Frontend validation should include real containerized compile/test runs because static review missed a JSX syntax error, a `slotGroups` union-typing regression, and brittle UI selectors; prefer stable `data-testid` hooks plus explicit cleanup for repeated-label tests. — decided by Squad Coordinator
