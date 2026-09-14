# ABI Trainer v1 — Test Plan

## Purpose

This document turns the locked game-design baseline into concrete Given/When/Then test cases that Mr. Pink and Mr. Orange can convert into Vitest coverage once the public engine/state/UI interfaces land.

Scope for this plan:

- inventory placement and geometry validation
- equipment/rule enforcement
- Training Mode timing, loot, and scoring
- balance/UX checks worth running as structured exploratory tests

Out of scope for now:

- implementation details of `src/data`, `src/engine`, `src/state`, or `src/components`
- direct source-code changes
- duplicate unit/component tests that Mr. Pink and Mr. Orange are already writing inside their own areas

## Test strategy

### Target test layers once code exists

1. **Engine acceptance tests**  
   Use public inventory/rules/run-simulation APIs to validate placement, equipment, nesting, timing, and scoring behavior.

2. **UI integration tests**  
   Use public component props/events to confirm drag/drop, invalid-placement feedback, visible compartment boundaries, and state-toggle failure messaging.

3. **Structured exploratory balance tests**  
   Run repeatable scenarios with fixed loot seeds/loadouts and record loot throughput, dead time, and dominant strategies.

### Harness expectations

To keep these cases easy to automate later, the implementation should preferably expose:

- deterministic timer control or fake-timer compatibility
- deterministic bot-loadout generation via seed or fixture injection
- public validation results with stable failure reasons/messages
- score breakdown visibility by secured region and item/container path

---

## 1. Placement and geometry test cases

### P1. Exact fit inside one compartment succeeds

**Given** a container compartment whose usable cells exactly match an item's rotated or unrotated occupied cells  
**And** the target cells are empty  
**When** the player places the item at the only position that fully fits inside that compartment  
**Then** the placement succeeds  
**And** every occupied item cell maps to a valid `1` cell in that same compartment  
**And** the item is recorded with the expected `parentContainerInstanceId`, `parentCompartmentId`, `gridX`, `gridY`, and rotation

### P2. Item too large for every compartment is rejected

**Given** a multi-compartment container where no single compartment can fully contain the item's occupied cells  
**When** the player attempts to place that item into each legal compartment option  
**Then** every placement attempt fails  
**And** each failure reports an out-of-bounds or no-fit result rather than partially placing the item

### P3. Item spanning a compartment boundary is rejected

**Given** two adjacent compartments that visually touch but are modeled as separate storage regions  
**And** an item whose footprint would occupy cells from both regions if placed across their shared edge  
**When** the player attempts that placement  
**Then** the placement is rejected  
**And** the validator reports that items cannot span compartment boundaries  
**And** no cells are reserved in either compartment

### P4. Rotation makes an otherwise invalid placement valid

**Given** an item with `allowRotation = true`  
**And** a compartment where the item does not fit in its default orientation but does fit when rotated  
**When** the player attempts placement without rotation  
**Then** the placement fails

**When** the player retries the same placement with the valid rotated orientation  
**Then** the placement succeeds  
**And** the stored rotation matches the accepted orientation  
**And** the occupied-cell mapping reflects the rotated mask, not the original mask

### P5. Overlapping placement is rejected

**Given** a compartment that already contains an item occupying one or more target cells  
**When** the player attempts to place a second item whose occupied cells overlap any occupied cell of the first item  
**Then** the placement is rejected  
**And** the original item remains unchanged  
**And** the second item is not partially inserted

### P6. Split-backpack example accepts placements wholly inside each named compartment

**Given** the exact `backpack_example_split` layout from the design document  
**And** its four compartments:

- `bp-example-top` with a `3x3` block at origin `(1,0)`
- `bp-example-left` with a `1x3` pouch at origin `(0,3)`
- `bp-example-center` with a `3x3` block at origin `(1,3)`
- `bp-example-right` with a `1x3` pouch at origin `(4,3)`

**When** the player places:

- a `3x3` item in `bp-example-top`
- a `1x3` item in `bp-example-left`
- a `3x3` item in `bp-example-center`
- a `1x3` item in `bp-example-right`

**Then** each placement succeeds only when targeted at its matching compartment  
**And** each item is stored against the correct compartment id

### P7. Split-backpack example rejects placements that cross top/lower or side/main boundaries

**Given** the exact `backpack_example_split` layout from the design document  
**When** the player attempts to place:

- a `3x4` item spanning `bp-example-top` into `bp-example-center`
- a `2x3` or wider item spanning `bp-example-left` into `bp-example-center`
- a `2x3` or wider item spanning `bp-example-center` into `bp-example-right`

**Then** each placement is rejected  
**And** the failure reason is compartment-boundary crossing, not a generic unknown error

### P8. Irregular mask rejects placements whose `0` cells hide a boundary violation

**Given** an irregular item mask with at least one internal `0` cell  
**And** a compartment layout where the item's bounding box overlaps an invalid region but its occupied `1` cells should still be evaluated precisely  
**When** the player attempts placement  
**Then** validation considers only occupied item cells for overlap/fit  
**But** still rejects the move if any occupied `1` cell lands outside the target compartment or on another item

### P9. Non-rotatable item remains invalid even if rotation would have helped geometrically

**Given** an item whose definition sets `allowRotation = false`  
**And** a compartment where the item would fit only if rotated  
**When** the player attempts rotated placement  
**Then** the placement is rejected  
**And** the failure reason indicates rotation is not allowed for that item

---

## 2. Equipment and rule-enforcement test cases

### E1. Equipping a shield first blocks a conflicting mask

**Given** a helmet that is compatible with a face shield  
**And** a face shield is already equipped in the `helmetFaceShield` slot  
**And** a mask whose compatibility rules conflict with that shield  
**When** the player attempts to equip the mask  
**Then** the equip action fails  
**And** the existing shield attachment remains intact  
**And** the returned failure explains that mask and shield cannot coexist

### E2. Equipping a conflicting mask first blocks later shield attachment

**Given** a helmet is equipped  
**And** a conflicting mask is already equipped  
**And** a compatible shield item exists in inventory  
**When** the player attempts to equip the shield into the `helmetFaceShield` slot  
**Then** the equip action fails  
**And** the mask remains equipped  
**And** the returned failure explains that the equipped mask blocks shield attachment

### E3. Headset-incompatible helmet blocks headset equip

**Given** a helmet whose tags explicitly deny headset use  
**And** that helmet is equipped  
**And** a headset item is available  
**When** the player attempts to equip the headset  
**Then** the equip action fails  
**And** the headset remains outside the headset slot  
**And** the failure message identifies helmet/headset incompatibility

### E4. Ballistic tactical vest blocks separate ballistic vest

**Given** a tactical vest definition marked as already ballistic  
**And** that tactical vest is equipped in the tactical-vest slot  
**And** a separate ballistic vest item is available  
**When** the player attempts to equip the ballistic vest  
**Then** the equip action fails  
**And** both vest slots remain unchanged  
**And** the failure message explains that the current tactical vest already satisfies/conflicts with ballistic armor usage

### E5. Separate ballistic vest blocks ballistic tactical vest

**Given** a ballistic vest is already equipped  
**And** a tactical vest definition marked as ballistic is available  
**When** the player attempts to equip that tactical vest  
**Then** the equip action fails  
**And** the existing ballistic vest remains equipped  
**And** the failure message explains the same mutual-exclusion rule in the opposite direction

### E6. Backpack nesting succeeds exactly through level 3

**Given** the worn backpack counts as nesting level 1  
**And** backpack A is worn by the player  
**And** backpack B is placed inside backpack A  
**When** the player places backpack C inside backpack B  
**Then** the placement succeeds  
**And** the resulting backpack chain depth is accepted as exactly 3

### E7. Backpack nesting fails at level 4

**Given** the worn backpack counts as nesting level 1  
**And** backpack A is worn by the player  
**And** backpack B is inside backpack A  
**And** backpack C is inside backpack B  
**When** the player attempts to place backpack D inside backpack C  
**Then** the placement fails  
**And** no backpack is added at depth 4  
**And** the failure message cites the maximum backpack nesting depth

### E8. Collapsing or rolling a non-empty container is always rejected in v1

**Given** a backpack or vest in an open/worn state currently contains one or more items  
**And** the target collapsed/rolled state would otherwise be legal for that item  
**When** the player attempts the state change  
**Then** the state change fails  
**And** all contained items remain in their original positions  
**And** the container remains in its original state  
**And** the failure message explains that collapsed/rolled states require the container to be empty in v1

### E9. Empty container can collapse only when the target state is otherwise legal

**Given** a backpack or vest with no contained items  
**And** the target collapsed/rolled state is valid for that item  
**When** the player changes to the collapsed/rolled state  
**Then** the state change succeeds  
**And** the container's state id updates to the requested state  
**And** the resulting state is not equippable if the design marks collapsed states as storage-only

### E10. Equipped container cannot remain worn in a non-equippable state

**Given** a container is currently equipped  
**And** its target state is marked `equippable = false`  
**When** the player attempts to switch directly to that target state without first unequipping it  
**Then** the state change fails  
**And** the equipped container remains in its original equippable state

---

## 3. Training Mode timing, loot, and scoring test cases

### T1. Bot 1 death occurs exactly at 1 second

**Given** a fresh Training Mode run with no spawned loot yet  
**When** simulated time advances to exactly `1.0s`  
**Then** bot 1's death event fires at that timestamp  
**And** exactly one new loot source exists  
**And** no earlier timestamp below `1.0s` produces that loot source

### T2. Bot 2 death occurs exactly at 31 seconds

**Given** the run has advanced past the first death  
**When** simulated time advances to exactly `31.0s`  
**Then** bot 2's death event fires at that timestamp  
**And** the total persistent loot-source count becomes 2

### T3. Bot 3 death occurs exactly at 61 seconds

**Given** the run is active  
**When** simulated time advances to exactly `61.0s`  
**Then** bot 3's death event fires  
**And** the total persistent loot-source count becomes 3

### T4. Bot 4 death occurs exactly at 91 seconds

**Given** the run is active  
**When** simulated time advances to exactly `91.0s`  
**Then** bot 4's death event fires  
**And** the total persistent loot-source count becomes 4

### T5. Bot 5 death occurs exactly at 121 seconds

**Given** the run is active  
**When** simulated time advances to exactly `121.0s`  
**Then** bot 5's death event fires  
**And** the total persistent loot-source count becomes 5

### T6. Bot 6 death occurs exactly at 151 seconds

**Given** the run is active  
**When** simulated time advances to exactly `151.0s`  
**Then** bot 6's death event fires  
**And** the total persistent loot-source count becomes 6  
**And** no additional scheduled bot deaths remain after that point

### T7. Run ends exactly at the 600-second hard cap when the player does not extract earlier

**Given** Training Mode is active at `599.9s`  
**When** simulated time advances to exactly `600.0s`  
**Then** the run transitions to `RunEnd` immediately  
**And** player inventory actions are no longer accepted after that transition  
**And** no grace-period window exists beyond `600.0s`

### T7a. Extract Now ends the run early and locks the penalty time immediately

**Given** Training Mode is active before `600.0s`  
**And** the player has secured some non-zero value  
**When** the player uses **Extract Now** at elapsed time `t`  
**Then** the run transitions to `RunEnd` immediately  
**And** the scoring time used for the time-penalty lookup is `t`, floored to whole seconds  
**And** later scheduled bot deaths do not occur because the run has already ended

### T8. Score sums all secured inventory regions, not just backpack contents

**Given** the player reaches run end holding secured value across multiple regions:

- an equipped helmet
- a weapon slot item
- an item in pockets
- items inside the tactical vest
- items inside the ballistic vest
- items inside the worn backpack
- items inside a nested container located within secured storage

**When** the score is computed  
**Then** `grossScore` equals the sum of every secured scoring item instance across all those regions  
**And** worn/equipped holder containers themselves do not add score just for being the container shell  
**And** the result is not limited to backpack contents alone

### T9. Uncollected ground loot does not count toward score

**Given** one or more bot loot drops remain on the ground at run end  
**And** at least one of those drops contains valuable items never moved into player-owned secured storage  
**When** the run is scored  
**Then** those uncollected items contribute `0` to `grossScore`  
**And** only the items actually secured by the player are counted

### T10. Time-penalty multiplier applies the correct bracket as elapsed time increases

**Given** otherwise identical secured inventory value at scoring time  
**When** the score is calculated after flooring elapsed time to whole seconds for each configured bracket:

- `0s–180s`
- `181s–300s`
- `301s–420s`
- `421s–540s`
- `541s–600s`

**Then** the multiplier applied is respectively:

- `1.00`
- `0.95`
- `0.85`
- `0.70`
- `0.50`

**And** `finalScore` is the floor of `grossScore * multiplier`

### T11. Time-penalty boundaries behave correctly at exact cutover values

**Given** a fixed gross score  
**When** the score is computed at these exact elapsed times:

- `180s`
- `181s`
- `300s`
- `301s`
- `420s`
- `421s`
- `540s`
- `541s`
- `600s`

**Then** each result uses the intended inclusive/exclusive bracket at the boundary  
**And** any off-by-one behavior is caught explicitly by the test

### T11a. Non-integer elapsed times are floored before bracket lookup

**Given** a fixed gross score  
**When** the score is computed at elapsed times such as:

- `180.1s`
- `180.9s`
- `300.9s`
- `540.9s`

**Then** the engine floors each time to:

- `180s`
- `180s`
- `300s`
- `540s`

**And** applies the earlier bracket in each case

### T12. Bots drop their full backpack and contents as one lootable unit

**Given** a bot loadout includes an equipped backpack containing other items  
**When** that bot dies and its loot source spawns  
**Then** the backpack itself appears as a lootable container instance in the drop  
**And** its contained items remain nested inside it  
**And** the player can loot those contained items directly from the ground container UI without first moving the entire backpack  
**And** the drop is not flattened into loose child items unless a later mode explicitly changes that rule

### T13. Secured nested container contents are counted only if the container chain ends in player-owned secured storage

**Given** one container with contents is moved into the player's secured storage  
**And** a second container with contents remains on the ground  
**When** scoring runs at the end of the timer  
**Then** the first container and its nested contents count toward `grossScore`  
**And** the second container and its nested contents contribute `0`

### T14. Multiple loot drops persist simultaneously for the full run

**Given** several bot deaths have already occurred  
**When** the player ignores earlier drops and time advances to later deaths  
**Then** the earlier loot sources still exist and remain lootable  
**And** the current ground-loot state contains one persistent source per dead bot that has not been otherwise consumed by gameplay rules

---

## 4. Balance and UX exploratory test cases

These are still written in Given/When/Then form so they can be executed manually first and later automated with fixtures, telemetry, or scripted playthrough helpers.

### B1. Ten-minute run length supports looting all six bots without requiring perfect play

**Given** a representative mid-skill player route and a representative seeded set of six bot drops  
**When** the scenario is played repeatedly under v1 controls for the full `600s` limit  
**Then** the player should usually have enough time to inspect and loot all six drops  
**And** the remaining time at completion should not require frame-perfect or menu-perfect behavior  
**And** record completion rate, average unused time, and common blockers if this expectation fails

### B2. Thirty-second death cadence leaves enough time to process each new drop

**Given** the fixed death schedule at `1/31/61/91/121/151s`  
**When** repeated playtests measure how long it takes to open a drop, evaluate it, and transfer a meaningful subset of items  
**Then** the player should usually be able to extract value from one drop before the next one appears  
**And** if players consistently leave a drop half-processed solely because the next death arrives too quickly, note the cadence as too tight

### B3. Training Mode resists a trivial solved strategy

**Given** multiple seeded loadout pools with different mixes of item size, value, and compatibility friction  
**When** playtests repeatedly optimize for a single obvious heuristic such as "always grab the same highest-value item family first"  
**Then** that single heuristic should not dominate across nearly all seeds  
**And** at least some runs should reward context-sensitive decisions about shape efficiency, slot compatibility, and container opportunity cost  
**And** if one strategy overwhelmingly wins, log the exploit pattern for rebalancing

### B4. Failure feedback is specific enough to teach the rule being broken

**Given** a player attempts invalid actions across placement, equipment, and state toggles  
**When** the UI rejects those actions  
**Then** the feedback should distinguish between overlap, out-of-bounds, boundary crossing, incompatibility, nesting-limit, and non-empty-collapse failures  
**And** repeated testers should be able to explain what rule they broke without needing developer-only debug context

---

## 5. Suggested suite structure once APIs exist

- `placement.geometry.acceptance.test.ts`
  - P1–P9
- `equipment.rules.acceptance.test.ts`
  - E1–E10
- `training-mode.timing-and-score.acceptance.test.ts`
  - T1–T14
- `training-mode.balance.exploratory.md` or equivalent tracked playtest sheet
  - B1–B4 findings per seed/build

Recommended test data styles:

- table-driven fixtures for item masks, layouts, and rule combinations
- fixed seeds or explicit bot-loadout fixtures for repeatable run tests
- fake timers for exact `1/31/61/91/121/151/600s` assertions

---

## 6. Open questions and test-blocking ambiguities

1. **Time-penalty vs. fixed 600-second run-end is internally inconsistent.**  
   The design says the run ends exactly at `600s` with no grace period, but it also defines a time-penalty curve for elapsed times from `0s` through `600s`. If players cannot end a run early, every finished run seems to score with the `541s–600s = 0.50` multiplier. Is there an intended early-finish/extract action, or should the penalty be based on something other than run-end time?

   **RESOLVED:** v1 adds an explicit **Extract Now** action. The time-penalty curve uses elapsed time at the exact moment of extraction, or `600s` if the player never extracts before the hard cap.

2. **Stackable item scoring is under-specified.**  
   `grossScore` is defined as the sum of `baseValue` of every secured item instance, but stackables also have `quantity` and `maxStack`. Is score for ammo/stackables `baseValue * quantity`, score per stack instance regardless of quantity, or catalog rows whose `baseValue` already represents the whole stack?

   **RESOLVED:** No stacking in v1. Remove `quantity`/`maxStack` from the v1 model and treat every secured item instance, including ammo and meds, as one discrete item scored once at its `baseValue`.

3. **Do secured container items score both their own base value and the value of their contents?**  
   The design clearly says contents count if secured, but it does not explicitly state whether a backpack/vest/container also adds its own `baseValue` on top of the contents at scoring time.

   **RESOLVED:** Active holder containers being worn/equipped by the player do **not** add their own `baseValue` in v1. Only their loose contents, nested loose items, equipped non-container items, and weapons count. This avoids double counting and makes the holder shell itself non-scoring while it is serving as the secured container.

4. **Pockets are counted for score but not explicitly modeled in the proposed data structures.**  
   Should pockets be implemented as ordinary container layouts, dedicated equipment slots with embedded compartments, or a separate secured region type?

   **RESOLVED:** Pockets are an ordinary container layout attached to a dedicated player equipment slot, with the same compartment model as other containers. They are not a special-case storage type.

5. **Rule H and Rule I need precedence clarification.**  
   Rule H says state changes are denied when contents would be stranded or invalidated. Rule I, inside the locked-rules section, says collapsed/rolled storage states can only be entered when empty, but its wording calls that a "recommended v1 simplification." Is Rule I mandatory for v1, or is geometry-preserving collapse allowed as long as Rule H still passes?

   **RESOLVED:** Rule I is mandatory in v1: collapsed/rolled storage states can only be entered when the container is completely empty. There is no geometry-preserving exception path in v1; Rule H is effectively subsumed by this stricter empty-only rule for collapsed/rolled states.

6. **Exact boundary inclusivity for the time-penalty brackets should be stated explicitly.**  
   The table shows `0s–180s`, `181s–300s`, etc., which implies whole-second discrete timing. Should elapsed time be floored/ceiled/rounded before bracket selection, and what happens at non-integer times such as `180.5s`?

   **RESOLVED:** Floor elapsed time to whole seconds before bracket lookup. Example: `180.9s` is treated as `180s`, so it uses the earlier/cheaper bracket.

7. **Bot-death event ordering at the exact timestamp is not specified.**  
   At exactly `31.0s`, does the new loot source appear before or after any player action queued for that same simulation tick/frame? The engine and UI tests need deterministic ordering.

   **RESOLVED:** If a queued player action and a scheduled bot-death event share the exact same tick/timestamp, resolve the player action first, then fire the bot death and loot spawn event.

8. **Shield attachment path needs one canonical public interface.**  
   The design includes both a `helmetFaceShield` slot and a distinct `attach-shield` action. Should tests treat shield mounting as slot-equipping, a special attachment action, or both?

   **RESOLVED:** Use the normal slot-equip path only. A shield is equipped into `helmetFaceShield` like any other equipment slot item; the separate `attach-shield` action is removed for v1.

9. **Rotation support is partly generic and partly constrained.**  
   Item instances store `0 | 90 | 180 | 270`, while the design also says v1 only needs `0` and `90`. Should `180` and `270` be legal and normalized as equivalent states, or rejected in v1-facing APIs?

   **RESOLVED:** v1 supports only `0°` and `90°`. `180°` and `270°` must be rejected as invalid in v1-facing APIs and validation paths, while remaining a possible future expansion.

10. **Ground-loot interaction rules for dropped backpacks are not fully specified.**  
   When a bot drops a backpack with contents intact, can the player loot items directly out of that ground container without first moving the backpack, or must the whole backpack be transferred/opened through a specific flow?

    **RESOLVED:** The dropped backpack is a visible, interactable ground container. Players may loot items directly out of it in the ground-loot panel without first transferring the whole backpack.
