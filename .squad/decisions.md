# Squad Decisions

## Active Decisions

### 2026-09-12: Source image assets must live in source-controlled asset folders
**By:** Squad Coordinator
**What:** Project-owned image assets that the app imports at runtime must be stored in `src/assets/` or `public/`, not only under `dist/`. The coordinator moved `operator.png` from `dist/assets/` into `src/assets/operator.png` before the UI swap so the source art survives clean builds and remains part of the editable project state.
**Why:** `dist/` is disposable build output and is routinely replaced by `vite build`. Treating build artifacts as the only copy of a runtime asset is fragile and can silently lose user-provided art on the next rebuild.

### 2026-09-12: Keep operator image in the existing stage wrapper
**By:** Mr. Orange
**What:** The equipment mannequin now renders the tracked `src/assets/operator.png` inside the existing `.equipment-screen__operator-stage` wrapper, with bottom-aligned contain sizing and stage padding so the callout/value overlay still sits cleanly over the tactical background.
**Why:** Reusing the same absolute stage layer swaps the fake silhouette for real art without disturbing panel spacing, overlay stacking, or nearby equipment rail layout.

### 2026-09-12: Core loop integration contract
**By:** Mr. White
**What:** For v1, `src/data` + `src/engine` + `src/state` are the gameplay source of truth. `src/components` must stop owning a parallel placeholder inventory model, slot-id scheme, rotation policy, and placement validator. Frontend code may keep a thin view-model/selector adapter for rendering, but all move/equip/rotate/state-change legality must come from engine-backed actions against `TrainingRunState`.
**Why:** The current UI shell is visually ahead of the real loop, but it is disconnected from the implemented catalog/rules/run engine and already drifts from locked v1 rules (`0°/90°` only, real slot ids, dynamic loot sources, real secured-value scoring). Unifying on one gameplay contract is the smallest path to a truly playable core loop instead of polishing a mock.

### 2026-09-12: Training state exposes storage-unit-centric UI selectors
**By:** Mr. Pink
**What:** `src/state/training-mode.ts` now exports UI-facing selectors over the real catalog/engine state as slot, item, storage-unit, loot-source, timer, and score view models, plus `validate*` helpers that reuse the same engine-backed legality checks as dispatched actions.
**Why:** Mr. Orange needs renderable data without rebuilding a second inventory model in `src/components`. Using storage units and item ids as the contract keeps nesting, collapse/open states, loot containers, and 0°/90° legality tied to the gameplay source of truth.

### 2026-09-12: React owns run lifecycle, selectors own gameplay truth
**By:** Mr. Orange
**What:** `src/App.tsx` now owns the training-mode reducer and the real-time tick interval, while `EquipmentScreen` and `GroundLootPanel` consume selector-built slot/storage/loot view models and only dispatch validated actions. Nested container UIs are rendered by traversing `containerStorageUnitId` with `selectStorageUnit`, never by rebuilding inventory structure in components.
**Why:** This keeps the browser layer thin: React handles screen flow and timing glue, but gameplay legality, storage geometry, loot persistence, scoring, and state transitions stay inside `src/state` + engine-backed selectors/actions.

### 2026-09-12: Unified ground loot view flattens nested drops into one stash grid
**By:** Mr. Orange
**What:** Reworked the ground-loot panel to flatten every uncollected loot item across all active loot sources into one continuous tile grid, including dropped container shells and the items nested inside their storage units. Tooltip value uses each item's `baseValue` from the training-mode item view, and per-source section wrappers were removed from the DOM.
**Why:** Mateus asked for the ABI-style "one big stash" read instead of separate source cards. Flattening in the render layer preserves Mr. Pink's engine/state ownership while keeping click-to-select/move behavior unchanged and giving the UI enough data for a lightweight hover tooltip.

### 2026-09-12: Ground-loot drag uses the shared selected-item placement pipeline
**By:** Mr. Orange
**What:** Ground stash tiles now start native HTML5 drag-and-drop by setting `dataTransfer` and calling the same `onItemSelect(itemId)` hook used by storage-grid and equipment-slot drags, with no special-case drop-path logic added downstream.
**Why:** `EquipmentScreen` already routes all placements through `selectedItem` + `handlePlaceItem` + engine-backed validation. Reusing that contract keeps ground-to-storage and ground-to-slot drags consistent with existing click-to-place behavior and avoids duplicating inventory move rules in the stash UI.

### 2026-09-12: Add player inventory drop-to-ground action and reusable loot pile
**By:** Mr. Pink
**What:** Added a new `DROP_ITEM_TO_GROUND` training-mode action plus an engine-level `dropItemToGround` run helper. Player-initiated drops now move an equipped or stored player-owned item into one stable synthetic loot source, `loot-source-player-drop`, reusing that same pile for every later player drop in the run.
**Why:** The engine previously only supported one-way item flow from ground loot into player storage/equipment. Mr. Orange needs a backend/state contract for drag-dropping or clicking an X to send gear back to the stash, and reusing one stable loot-source id lets selectors/UI treat the dropped gear as one continuous ground pile. Full backpacks are explicitly allowed because bot-death drops already preserve container shells plus nested contents, so matching that behavior keeps the ownership/containment model consistent instead of inventing a player-only restriction.

### 2026-09-12: Keep the ground stash grid mounted even when empty
**By:** Mr. Orange
**What:** The unified `ground-loot-grid` container now stays rendered in the empty-state view so player-owned items can be dropped onto the stash before any bot loot exists, while the empty-state copy renders inside that same grid shell.
**Why:** The new drop-to-ground interaction needs a stable drag target for the very first discard. Keeping one persistent grid container preserves test hooks, avoids special-case empty-state drop wiring, and matches the "one big stash" interaction model.

### 2026-09-11: Prefer deterministic fixtures for timing and loot tests
**By:** Mr. Blue
**What:** Training Mode timing/scoring tests should use fake timers plus seeded or explicit loot fixtures, and placement/rule tests should use table-driven fixture cases derived from the locked design layouts.
**Why:** Exact assertions at 1/31/61/91/121/151/600 seconds and repeatable balance checks will be brittle if they depend on live clocks or uncontrolled random loot generation.

### 2026-09-11: Compartment-aware grid API in frontend shell
**By:** Mr. Orange
**What:** The equipment UI shell accepts container layouts as multiple named regions with independent shape masks and hard placement boundaries, even in placeholder mode.
**Why:** Mr. Pink's engine contract is expected to expose irregular footprints and split compartments, so matching that shape now keeps the integration diff small instead of forcing a later UI rewrite.

### 2026-09-11: Engine data contracts for compartments and rules
**By:** Mr. Pink
**What:** Represented container storage as item-backed or virtual `StorageUnit` records, with placements always targeting one explicit compartment id plus local `gridX/gridY` coordinates. Rule validation is driven by a typed `RuleDefinition` table and a generic evaluator registry rather than per-item `if/else` chains.
**Why:** This keeps compartment-boundary enforcement, nested containers, pockets, and future container types on one model while making compatibility/state rules easy to extend without rewriting inventory logic.

### 2026-09-12: Layout-aware placement validation distinguishes neighbor crossing from true out-of-bounds
**By:** Mr. Pink
**What:** `validatePlacement` now accepts an optional `layout` and, when provided, reports `crosses-compartment-boundary` for cells that spill from one compartment into another while preserving `out-of-bounds` for cells that leave the overall layout bounds.
**Why:** Mr. Blue needed a clean way to test split-backpack boundary failures (P7) without inventing UI-level geometry logic, and Mr. Orange may want the same distinction for user feedback.

### 2026-09-12: Locked v1 scoring and extraction updates
**By:** Mr. Pink
**What:** Updated the engine so Training Mode supports explicit `Extract Now`, elapsed time is floored before time-penalty lookup, holder-container shells are never scored, pockets are modeled as a normal equipped container item, and v1 rotation/state rules are hard-limited to `0°/90°` plus empty-only collapse.
**Why:** These were the newly locked design answers. Encoding them explicitly keeps UI wiring deterministic, prevents silent scoring drift, and removes the half-supported stacking/attachment/state-exception paths from the engine contract.

### 2026-09-11: Dead bots drop backpacks as intact loot containers
**By:** Mr. White
**What:** When a bot dies in Training Mode, its equipped backpack drops as loot along with the rest of its carried/equipped items. The backpack remains a lootable container instance and preserves any contents inside it.
**Why:** Mateus explicitly confirmed that dead bots should drop the whole bag, not just flattened loose contents. This affects loot generation, container ownership, scoring, and UI behavior, so the team needs one shared rule.

### 2026-09-12: Standardize local onboarding on a Node 24 dev container
**By:** Mr. White
**What:** Added a VS Code Dev Container using `mcr.microsoft.com/devcontainers/javascript-node:1-24-bookworm`, forwarding Vite port 5173, auto-running `npm install`, and recommending React/TypeScript/Vitest-friendly VS Code extensions.
**Why:** Mateus does not want Node.js installed on the host machine, and the repo has already been validated on Node v24.21.0 / npm 11.19.0 with no `engines` override in `package.json`, so a Node 24 official devcontainer image is the closest low-friction match.

### 2026-09-11: Do not reuse ABI copyrighted assets
**By:** Mr. White
**What:** The project should copy the ABI equipment screen's interaction model and broad layout structure, but must use original placeholder art, icons, silhouettes, and UI assets rather than ABI's copyrighted game assets.
**Why:** The user's goal is a close functional/UI clone for planning and gameplay, not asset copying. This keeps the project legally safer and gives the team a clear art-direction guardrail before implementation starts.

### 2026-09-11: Remove Health tab from v1
**By:** Mr. White
**What:** The ABI Trainer v1 plan removes the Health tab entirely. The equipment screen should use a single equipment-focused header/layout and should not ship a Health tab, even as a placeholder.
**Why:** Mateus explicitly removed the Health tab from v1 scope. Keeping it out now avoids fake UI, reduces implementation surface area, and keeps the first slice focused on the packing loop.

### 2026-09-11: Lock the bootstrap folder and test layout
**By:** Mr. White
**What:** The repo bootstrap uses a Vite + React + TypeScript root app, with domain boundaries split across `src/data`, `src/engine`, `src/components`, `src/state`, and Vitest wired to both `src/**/__tests__` and co-located `*.test.ts(x)` or `*.spec.ts(x)` files.
**Why:** Pink, Orange, and Blue need clean ownership boundaries and a working test runner before feature work starts, so the skeleton should encode those boundaries up front rather than force later churn in shared setup files.

### 2026-09-12: Locking v1 ambiguity resolutions
**By:** Mr. White
**What:** Locked ten v1 documentation decisions: add an explicit Extract Now action; remove stacking and `quantity`/`maxStack` from v1; score only secured contents plus equipped non-container items and weapons, not active holder-container shells; model pockets as an ordinary slot-attached container layout; make empty-only collapse/roll mandatory in v1; floor elapsed seconds before time-penalty bracket lookup; resolve same-tick ordering as player action first, then bot death; equip shields only through the `helmetFaceShield` slot-equip path; allow only `0°`/`90°` rotation in v1 and reject `180°`/`270°`; and allow direct looting from dropped ground backpacks.
**Why:** These answers remove the last test-blocking ambiguities, simplify the v1 implementation surface, and give Pink, Orange, and Blue one unambiguous ruleset for engine, UI, and test work.

### 2026-09-12: Add players-remaining HUD readout
**By:** Mr. Orange
**What:** The equipment HUD now shows surviving bots as `remaining / total players remaining`, sourced from a shared training-mode selector over `run.botRoster`.
**Why:** Keeping the count in a selector preserves the engine-backed UI contract while giving the HUD a lightweight live progress cue.

### 2026-09-12: R key mirrors the selected-item Rotate action
**By:** Squad Coordinator
**What:** Pressing `R` now rotates the currently selected item by reusing the existing `handleRotateSelectedItem` path, mirroring the Rotate button. The keyboard shortcut ignores input, textarea, and contentEditable focus targets, and it does not fire while Ctrl, Cmd, or Alt modifiers are held.
**Why:** This adds a faster keyboard path for item rotation without introducing a second validation or dispatch flow, preserving the same legality checks, state updates, and user feedback as the existing button interaction.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
