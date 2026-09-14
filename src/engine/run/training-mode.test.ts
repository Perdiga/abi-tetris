import { describe, expect, it } from 'vitest'
import { createCatalogIndex } from '../../data'
import {
  addItemInstance,
  createEmptyInventoryState,
  createItemInstance,
  equipItemToSlot,
  getChildItems,
  getStorageUnitForItem,
  placeItemInStorage,
} from '../inventory'
import {
  PLAYER_DROP_LOOT_SOURCE_ID,
  advanceTrainingRun,
  createTrainingRunState,
  dropItemToGround,
  getTimePenaltyMultiplier,
  scoreTrainingRun,
} from './index'

const catalog = createCatalogIndex()
const advanceToElapsed = (state: ReturnType<typeof createTrainingRunState>, elapsedSeconds: number) =>
  advanceTrainingRun(state, { type: 'ADVANCE_TIME', deltaSeconds: elapsedSeconds - state.elapsedSeconds }, catalog)
const createStartedRun = () => advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
const createStartedRunWithPlayerDropFixtures = () => {
  const started = createStartedRun()
  let inventory = started.inventory
  const items = [
    createItemInstance('backpack-split', catalog, { id: 'player-backpack', ownerEntityId: 'player' }),
    createItemInstance('weapon-pistol-service', catalog, { id: 'player-pistol', ownerEntityId: 'player' }),
    createItemInstance('ammo-556-box', catalog, { id: 'player-backpack-item-0', ownerEntityId: 'player' }),
    createItemInstance('consumable-ration', catalog, { id: 'player-backpack-item-1', ownerEntityId: 'player' }),
  ]

  inventory = items.reduce((nextState, item) => addItemInstance(nextState, item, catalog), inventory)
  inventory = expectSuccessfulEquip(inventory, 'player-backpack', 'backpack')
  inventory = expectSuccessfulEquip(inventory, 'player-pistol', 'pistol')

  const backpackStorage = getStorageUnitForItem(inventory, 'player-backpack')
  inventory = expectSuccessfulPlacement(inventory, {
    itemInstanceId: 'player-backpack-item-0',
    targetStorageUnitId: backpackStorage!.id,
    targetCompartmentId: 'bp-example-top',
    x: 0,
    y: 0,
  })
  inventory = expectSuccessfulPlacement(inventory, {
    itemInstanceId: 'player-backpack-item-1',
    targetStorageUnitId: backpackStorage!.id,
    targetCompartmentId: 'bp-example-right',
    x: 0,
    y: 0,
  })

  return {
    ...started,
    inventory,
  }
}

const expectSuccessfulEquip = (
  state: ReturnType<typeof createEmptyInventoryState>,
  itemInstanceId: string,
  slotId: Parameters<typeof equipItemToSlot>[2],
) => {
  const result = equipItemToSlot(state, itemInstanceId, slotId, catalog)
  expect(result.ok).toBe(true)
  return result.ok ? result.state : state
}

const expectSuccessfulPlacement = (
  state: ReturnType<typeof createEmptyInventoryState>,
  options: Parameters<typeof placeItemInStorage>[1],
) => {
  const result = placeItemInStorage(state, options, catalog)
  expect(result.ok).toBe(true)
  return result.ok ? result.state : state
}

const createFixedGrossScoreInventory = () => {
  let inventory = createEmptyInventoryState(catalog)
  const pockets = createItemInstance('pockets-standard', catalog, { id: 'score-pockets', ownerEntityId: 'player' })
  const radio = createItemInstance('misc-radio', catalog, { id: 'score-radio', ownerEntityId: 'player' })
  const ammo = createItemInstance('ammo-556-box', catalog, { id: 'score-ammo', ownerEntityId: 'player' })
  inventory = [pockets, radio, ammo].reduce((nextState, item) => addItemInstance(nextState, item, catalog), inventory)
  inventory = expectSuccessfulEquip(inventory, pockets.id, 'pockets')
  const pocketsStorage = getStorageUnitForItem(inventory, pockets.id)
  inventory = expectSuccessfulPlacement(inventory, {
    itemInstanceId: radio.id,
    targetStorageUnitId: pocketsStorage!.id,
    targetCompartmentId: 'pockets-main',
    x: 0,
    y: 0,
  })
  inventory = expectSuccessfulPlacement(inventory, {
    itemInstanceId: ammo.id,
    targetStorageUnitId: pocketsStorage!.id,
    targetCompartmentId: 'pockets-main',
    x: 1,
    y: 2,
  })
  return inventory
}

describe('training mode run state machine', () => {
  it('progresses through load, bot deaths, and scoring on the locked schedule', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)

    expect(started.phase).toBe('RunActive')
    expect(started.activePhase).toBe('AwaitNextBotDeath')
    expect(started.pendingBotDeaths).toHaveLength(6)

    const afterFirstSecond = advanceTrainingRun(started, { type: 'ADVANCE_TIME', deltaSeconds: 1 }, catalog)
    expect(afterFirstSecond.lootSources).toHaveLength(1)
    expect(afterFirstSecond.activePhase).toBe('PlayerLooting')
    expect(afterFirstSecond.phaseHistory).toContain('RunActive:SpawnLootDrop')

    const afterAllDrops = advanceTrainingRun(afterFirstSecond, { type: 'ADVANCE_TIME', deltaSeconds: 150 }, catalog)
    expect(afterAllDrops.lootSources).toHaveLength(6)

    const finished = advanceTrainingRun(afterAllDrops, { type: 'ADVANCE_TIME', deltaSeconds: 449 }, catalog)
    expect(finished.phase).toBe('ResultsScreen')
    expect(finished.runEndReason).toBe('time-cap')
    expect(finished.score?.scoringElapsedSeconds).toBe(600)
    expect(finished.phaseHistory.slice(-3)).toEqual(['RunEnd', 'ScoreRun', 'ResultsScreen'])
  })

  it('supports Extract Now and locks scoring time immediately', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const advanced = advanceTrainingRun(started, { type: 'ADVANCE_TIME', deltaSeconds: 180.9 }, catalog)
    const extracted = advanceTrainingRun(advanced, { type: 'EXTRACT_NOW' }, catalog)

    expect(extracted.phase).toBe('ResultsScreen')
    expect(extracted.runEndReason).toBe('extract')
    expect(extracted.score?.scoringElapsedSeconds).toBe(180)
    expect(extracted.lootSources).toHaveLength(6)
  })

  it('starts runs with an empty player loadout and zero secured score', () => {
    const started = createStartedRun()

    expect(Object.values(started.inventory.equipment).every((itemId) => itemId === null)).toBe(true)
    expect(
      Object.values(started.inventory.itemInstances).filter((item) => item.ownerEntityId === 'player'),
    ).toEqual([])
    expect(scoreTrainingRun(started.inventory, 0, catalog)).toMatchObject({
      grossScore: 0,
      finalScore: 0,
      medal: 'No Medal',
    })
  })

  it('fires bot deaths 2 through 6 only at 31/61/91/121/151 seconds', () => {
    let state = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    state = advanceToElapsed(state, 1)
    expect(state.lootSources).toHaveLength(1)

    const checkpoints = [
      { before: 30.999, exact: 31, totalLootSources: 2, botId: 'bot-2' },
      { before: 60.999, exact: 61, totalLootSources: 3, botId: 'bot-3' },
      { before: 90.999, exact: 91, totalLootSources: 4, botId: 'bot-4' },
      { before: 120.999, exact: 121, totalLootSources: 5, botId: 'bot-5' },
      { before: 150.999, exact: 151, totalLootSources: 6, botId: 'bot-6' },
    ] as const

    for (const checkpoint of checkpoints) {
      state = advanceToElapsed(state, checkpoint.before)
      expect(state.lootSources).toHaveLength(checkpoint.totalLootSources - 1)

      state = advanceToElapsed(state, checkpoint.exact)
      expect(state.lootSources).toHaveLength(checkpoint.totalLootSources)
      expect(state.lootSources.at(-1)).toMatchObject({
        botId: checkpoint.botId,
        spawnedAtSeconds: checkpoint.exact,
      })
    }

    expect(state.pendingBotDeaths).toEqual([])
  })

  it('ends exactly at the 600-second hard cap with no grace period beyond it', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const beforeCap = advanceToElapsed(started, 599.9)

    expect(beforeCap.phase).toBe('RunActive')
    expect(beforeCap.runEndReason).toBeUndefined()

    const atCap = advanceToElapsed(beforeCap, 600)
    expect(atCap.phase).toBe('ResultsScreen')
    expect(atCap.runEndReason).toBe('time-cap')
    expect(atCap.score?.scoringElapsedSeconds).toBe(600)

    const beyondCap = advanceTrainingRun(atCap, { type: 'ADVANCE_TIME', deltaSeconds: 1 }, catalog)
    expect(beyondCap).toEqual(atCap)
  })

  it('floors elapsed seconds before time-penalty bracket lookup', () => {
    expect(getTimePenaltyMultiplier(180.9, catalog)).toBe(1)
    expect(getTimePenaltyMultiplier(181, catalog)).toBe(0.95)
  })

  it('resolves a queued Extract Now action before a same-tick bot death', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const beforeSecondDrop = advanceTrainingRun(started, { type: 'ADVANCE_TIME', deltaSeconds: 30 }, catalog)
    expect(beforeSecondDrop.lootSources).toHaveLength(1)

    const extractedOnDeathTick = advanceTrainingRun(
      beforeSecondDrop,
      { type: 'ADVANCE_TIME', deltaSeconds: 0.9999999999999964, queuedAction: { type: 'EXTRACT_NOW' } },
      catalog,
    )

    expect(extractedOnDeathTick.phase).toBe('ResultsScreen')
    expect(extractedOnDeathTick.runEndReason).toBe('extract')
    expect(extractedOnDeathTick.lootSources).toHaveLength(1)
    expect(extractedOnDeathTick.phaseHistory).toContain('RunActive:ExtractNow')
  })

  it('scores secured loot items but excludes holder container shells themselves', () => {
    let inventory = createEmptyInventoryState(catalog)
    const pockets = createItemInstance('pockets-standard', catalog, { id: 'pockets', ownerEntityId: 'player' })
    const backpack = createItemInstance('backpack-split', catalog, { id: 'backpack', ownerEntityId: 'player' })
    const pistol = createItemInstance('weapon-pistol-service', catalog, { id: 'pistol', ownerEntityId: 'player' })
    const ammo = createItemInstance('ammo-556-box', catalog, { id: 'ammo', ownerEntityId: 'player' })
    inventory = [pockets, backpack, pistol, ammo].reduce(
      (nextState, item) => addItemInstance(nextState, item, catalog),
      inventory,
    )

    const equippedPockets = equipItemToSlot(inventory, pockets.id, 'pockets', catalog)
    expect(equippedPockets.ok).toBe(true)
    const equippedBackpack = equipItemToSlot(equippedPockets.ok ? equippedPockets.state : inventory, backpack.id, 'backpack', catalog)
    expect(equippedBackpack.ok).toBe(true)
    const equippedPistol = equipItemToSlot(equippedBackpack.ok ? equippedBackpack.state : inventory, pistol.id, 'pistol', catalog)
    expect(equippedPistol.ok).toBe(true)

    const backpackStorage = getStorageUnitForItem(equippedPistol.ok ? equippedPistol.state : inventory, backpack.id)
    const placedAmmo = placeItemInStorage(
      equippedPistol.ok ? equippedPistol.state : inventory,
      {
        itemInstanceId: ammo.id,
        targetStorageUnitId: backpackStorage!.id,
        targetCompartmentId: 'bp-example-top',
        x: 0,
        y: 0,
      },
      catalog,
    )
    expect(placedAmmo.ok).toBe(true)

    const score = scoreTrainingRun(placedAmmo.ok ? placedAmmo.state : inventory, 120, catalog)
    expect(score.grossScore).toBe(2600 + 950)
  })

  it('scores every secured region, including nested secured containers, rather than only backpack contents', () => {
    let inventory = createEmptyInventoryState(catalog)
    const items = [
      createItemInstance('pockets-standard', catalog, { id: 'pockets', ownerEntityId: 'player' }),
      createItemInstance('vest-tactical-rig', catalog, { id: 'tactical', ownerEntityId: 'player' }),
      createItemInstance('vest-ballistic-compact', catalog, { id: 'ballistic', ownerEntityId: 'player' }),
      createItemInstance('backpack-split', catalog, { id: 'backpack', ownerEntityId: 'player' }),
      createItemInstance('backpack-split', catalog, { id: 'nested-backpack', ownerEntityId: 'player' }),
      createItemInstance('helmet-assault', catalog, { id: 'helmet', ownerEntityId: 'player' }),
      createItemInstance('weapon-pistol-service', catalog, { id: 'pistol', ownerEntityId: 'player' }),
      createItemInstance('ammo-556-box', catalog, { id: 'pocket-ammo', ownerEntityId: 'player' }),
      createItemInstance('consumable-ration', catalog, { id: 'tactical-ration', ownerEntityId: 'player' }),
      createItemInstance('misc-radio', catalog, { id: 'ballistic-radio', ownerEntityId: 'player' }),
      createItemInstance('ammo-556-box', catalog, { id: 'backpack-ammo', ownerEntityId: 'player' }),
      createItemInstance('medkit-field', catalog, { id: 'nested-medkit', ownerEntityId: 'player' }),
    ]
    inventory = items.reduce((nextState, item) => addItemInstance(nextState, item, catalog), inventory)

    inventory = expectSuccessfulEquip(inventory, 'pockets', 'pockets')
    inventory = expectSuccessfulEquip(inventory, 'tactical', 'tacticalVest')
    inventory = expectSuccessfulEquip(inventory, 'ballistic', 'ballisticVest')
    inventory = expectSuccessfulEquip(inventory, 'backpack', 'backpack')
    inventory = expectSuccessfulEquip(inventory, 'helmet', 'helmet')
    inventory = expectSuccessfulEquip(inventory, 'pistol', 'pistol')

    const pocketsStorage = getStorageUnitForItem(inventory, 'pockets')
    const tacticalStorage = getStorageUnitForItem(inventory, 'tactical')
    const ballisticStorage = getStorageUnitForItem(inventory, 'ballistic')
    const backpackStorage = getStorageUnitForItem(inventory, 'backpack')

    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: 'pocket-ammo',
      targetStorageUnitId: pocketsStorage!.id,
      targetCompartmentId: 'pockets-main',
      x: 0,
      y: 0,
    })
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: 'tactical-ration',
      targetStorageUnitId: tacticalStorage!.id,
      targetCompartmentId: 'tactical-center',
      x: 0,
      y: 0,
    })
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: 'ballistic-radio',
      targetStorageUnitId: ballisticStorage!.id,
      targetCompartmentId: 'ballistic-vest-main',
      x: 0,
      y: 0,
    })
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: 'backpack-ammo',
      targetStorageUnitId: backpackStorage!.id,
      targetCompartmentId: 'bp-example-top',
      x: 0,
      y: 0,
    })
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: 'nested-backpack',
      targetStorageUnitId: backpackStorage!.id,
      targetCompartmentId: 'bp-example-center',
      x: 0,
      y: 0,
    })

    const nestedBackpackStorage = getStorageUnitForItem(inventory, 'nested-backpack')
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: 'nested-medkit',
      targetStorageUnitId: nestedBackpackStorage!.id,
      targetCompartmentId: 'bp-example-top',
      x: 0,
      y: 0,
    })

    const score = scoreTrainingRun(inventory, 120, catalog)
    expect(score.grossScore).toBe(4200 + 2600 + 950 + 450 + 1800 + 950 + 3100)
    expect(score.finalScore).toBe(score.grossScore)
  })

  it('does not count uncollected ground loot toward the final score', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const afterFirstDrop = advanceToElapsed(started, 1)

    expect(afterFirstDrop.lootSources).toHaveLength(1)

    const scoreBeforeDrop = scoreTrainingRun(started.inventory, 120, catalog)
    const scoreWithGroundLootPresent = scoreTrainingRun(afterFirstDrop.inventory, 120, catalog)

    expect(scoreWithGroundLootPresent).toMatchObject(scoreBeforeDrop)
  })

  it('does not count loose player-owned items unless they are actually secured in equipment or secured storage', () => {
    let inventory = createEmptyInventoryState(catalog)
    const looseRadio = createItemInstance('misc-radio', catalog, { id: 'loose-radio', ownerEntityId: 'player' })
    inventory = addItemInstance(inventory, looseRadio, catalog)

    const score = scoreTrainingRun(inventory, 120, catalog)
    expect(score.grossScore).toBe(0)
  })

  it('applies the correct time-penalty bracket and floors final score per bracket', () => {
    const inventory = createFixedGrossScoreInventory()

    const cases = [
      { elapsedSeconds: 180, multiplier: 1, finalScore: 2750 },
      { elapsedSeconds: 181, multiplier: 0.95, finalScore: 2612 },
      { elapsedSeconds: 301, multiplier: 0.85, finalScore: 2337 },
      { elapsedSeconds: 421, multiplier: 0.7, finalScore: 1925 },
      { elapsedSeconds: 541, multiplier: 0.5, finalScore: 1375 },
    ] as const

    for (const testCase of cases) {
      const score = scoreTrainingRun(inventory, testCase.elapsedSeconds, catalog)
      expect(score.grossScore).toBe(2750)
      expect(score.timePenaltyMultiplier).toBe(testCase.multiplier)
      expect(score.finalScore).toBe(testCase.finalScore)
    }
  })

  it('uses the intended inclusive boundaries at every time-penalty cutover', () => {
    const expectedMultipliersByElapsedSecond = new Map([
      [180, 1],
      [181, 0.95],
      [300, 0.95],
      [301, 0.85],
      [420, 0.85],
      [421, 0.7],
      [540, 0.7],
      [541, 0.5],
      [600, 0.5],
    ])

    for (const [elapsedSeconds, multiplier] of expectedMultipliersByElapsedSecond) {
      expect(getTimePenaltyMultiplier(elapsedSeconds, catalog)).toBe(multiplier)
    }
  })

  it('floors non-integer elapsed times before looking up the time-penalty bracket', () => {
    const cases = [
      { elapsedSeconds: 180.1, flooredSeconds: 180, multiplier: 1 },
      { elapsedSeconds: 180.9, flooredSeconds: 180, multiplier: 1 },
      { elapsedSeconds: 300.9, flooredSeconds: 300, multiplier: 0.95 },
      { elapsedSeconds: 540.9, flooredSeconds: 540, multiplier: 0.7 },
    ] as const

    for (const testCase of cases) {
      const score = scoreTrainingRun(createFixedGrossScoreInventory(), testCase.elapsedSeconds, catalog)
      expect(score.scoringElapsedSeconds).toBe(testCase.flooredSeconds)
      expect(score.timePenaltyMultiplier).toBe(testCase.multiplier)
    }
  })

  it('drops a bot backpack as one lootable unit with its contents still nested inside it', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const afterFirstDrop = advanceToElapsed(started, 1)
    const lootSource = afterFirstDrop.lootSources[0]!
    const droppedBackpackId = lootSource.itemIds.find(
      (itemId) => afterFirstDrop.inventory.itemInstances[itemId]?.itemDefinitionId === 'backpack-split',
    )

    expect(droppedBackpackId).toBeDefined()

    const droppedBackpackStorage = getStorageUnitForItem(afterFirstDrop.inventory, droppedBackpackId!)
    const nestedChildren = getChildItems(afterFirstDrop.inventory, droppedBackpackStorage!.id)

    expect(nestedChildren.length).toBeGreaterThan(0)
    expect(lootSource.itemIds).toContain(droppedBackpackId!)
    nestedChildren.forEach((child) => {
      expect(lootSource.itemIds).not.toContain(child.id)
      expect(afterFirstDrop.inventory.itemInstances[child.id]?.ownerEntityId).toBe(lootSource.id)
    })
  })

  it('drops an equipped player item into the reusable ground pile', () => {
    const started = createStartedRunWithPlayerDropFixtures()

    const dropped = dropItemToGround(started, 'player-pistol', 12)
    const lootSource = dropped.lootSources.find((source) => source.id === PLAYER_DROP_LOOT_SOURCE_ID)

    expect(lootSource).toMatchObject({
      id: PLAYER_DROP_LOOT_SOURCE_ID,
      botId: 'player-drop',
      label: 'Dropped Gear',
      spawnedAtSeconds: 12,
      itemIds: ['player-pistol'],
    })
    expect(dropped.inventory.itemInstances['player-pistol']).toMatchObject({
      ownerEntityId: PLAYER_DROP_LOOT_SOURCE_ID,
      equippedSlotId: undefined,
      parentStorageUnitId: undefined,
      parentCompartmentId: undefined,
      gridX: undefined,
      gridY: undefined,
    })
    expect(dropped.inventory.equipment.pistol).toBeNull()
  })

  it('drops a stored player item into ground loot without flattening it into a new container', () => {
    const started = createStartedRunWithPlayerDropFixtures()
    const backpackStorage = getStorageUnitForItem(started.inventory, 'player-backpack')

    const dropped = dropItemToGround(started, 'player-backpack-item-0', 18)

    expect(dropped.lootSources.find((source) => source.id === PLAYER_DROP_LOOT_SOURCE_ID)?.itemIds).toEqual([
      'player-backpack-item-0',
    ])
    expect(dropped.inventory.itemInstances['player-backpack-item-0']).toMatchObject({
      ownerEntityId: PLAYER_DROP_LOOT_SOURCE_ID,
      equippedSlotId: undefined,
      parentStorageUnitId: undefined,
      parentCompartmentId: undefined,
      gridX: undefined,
      gridY: undefined,
    })
    expect(getChildItems(dropped.inventory, backpackStorage!.id).map((child) => child.id)).toEqual(['player-backpack-item-1'])
  })

  it('drops a loaded player backpack with its nested contents still attached and ground-owned', () => {
    const started = createStartedRunWithPlayerDropFixtures()

    const dropped = dropItemToGround(started, 'player-backpack', 24)
    const droppedBackpackStorage = getStorageUnitForItem(dropped.inventory, 'player-backpack')
    const nestedChildren = getChildItems(dropped.inventory, droppedBackpackStorage!.id)

    expect(dropped.lootSources.find((source) => source.id === PLAYER_DROP_LOOT_SOURCE_ID)?.itemIds).toEqual([
      'player-backpack',
    ])
    expect(dropped.inventory.itemInstances['player-backpack']).toMatchObject({
      ownerEntityId: PLAYER_DROP_LOOT_SOURCE_ID,
      equippedSlotId: undefined,
      parentStorageUnitId: undefined,
      parentCompartmentId: undefined,
      gridX: undefined,
      gridY: undefined,
    })
    expect(dropped.inventory.equipment.backpack).toBeNull()
    expect(nestedChildren.map((child) => child.id).sort()).toEqual(['player-backpack-item-0', 'player-backpack-item-1'])
    nestedChildren.forEach((child) => {
      expect(child.ownerEntityId).toBe(PLAYER_DROP_LOOT_SOURCE_ID)
      expect(child.parentStorageUnitId).toBe(droppedBackpackStorage!.id)
    })
  })

  it('appends repeated player drops into the same reusable ground pile', () => {
    const started = createStartedRunWithPlayerDropFixtures()

    const afterFirstDrop = dropItemToGround(started, 'player-pistol', 5)
    const afterSecondDrop = dropItemToGround(afterFirstDrop, 'player-backpack-item-0', 30)
    const playerDropSources = afterSecondDrop.lootSources.filter((source) => source.id === PLAYER_DROP_LOOT_SOURCE_ID)

    expect(playerDropSources).toHaveLength(1)
    expect(playerDropSources[0]).toMatchObject({
      spawnedAtSeconds: 5,
      itemIds: ['player-pistol', 'player-backpack-item-0'],
    })
  })

  it('counts nested contents only when their container chain ends in player-owned secured storage', () => {
    let inventory = createEmptyInventoryState(catalog)
    const playerBackpack = createItemInstance('backpack-split', catalog, { id: 'player-backpack', ownerEntityId: 'player' })
    const nestedPlayerBackpack = createItemInstance('backpack-split', catalog, {
      id: 'nested-player-backpack',
      ownerEntityId: 'player',
    })
    const playerAmmo = createItemInstance('ammo-556-box', catalog, { id: 'player-ammo', ownerEntityId: 'player' })
    const groundBackpack = createItemInstance('backpack-split', catalog, { id: 'ground-backpack', ownerEntityId: 'loot-source-1' })
    const groundAmmo = createItemInstance('ammo-556-box', catalog, { id: 'ground-ammo', ownerEntityId: 'loot-source-1' })
    inventory = [playerBackpack, nestedPlayerBackpack, playerAmmo, groundBackpack, groundAmmo].reduce(
      (nextState, item) => addItemInstance(nextState, item, catalog),
      inventory,
    )

    inventory = expectSuccessfulEquip(inventory, playerBackpack.id, 'backpack')
    const playerBackpackStorage = getStorageUnitForItem(inventory, playerBackpack.id)
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: nestedPlayerBackpack.id,
      targetStorageUnitId: playerBackpackStorage!.id,
      targetCompartmentId: 'bp-example-center',
      x: 0,
      y: 0,
    })

    const nestedPlayerBackpackStorage = getStorageUnitForItem(inventory, nestedPlayerBackpack.id)
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: playerAmmo.id,
      targetStorageUnitId: nestedPlayerBackpackStorage!.id,
      targetCompartmentId: 'bp-example-top',
      x: 0,
      y: 0,
    })

    const groundBackpackStorage = getStorageUnitForItem(inventory, groundBackpack.id)
    inventory = expectSuccessfulPlacement(inventory, {
      itemInstanceId: groundAmmo.id,
      targetStorageUnitId: groundBackpackStorage!.id,
      targetCompartmentId: 'bp-example-top',
      x: 0,
      y: 0,
    })

    const score = scoreTrainingRun(inventory, 120, catalog)
    expect(score.grossScore).toBe(950)
  })

  it('keeps multiple loot drops alive simultaneously for the entire run when the player ignores them', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const afterFourthDrop = advanceToElapsed(started, 91)

    expect(afterFourthDrop.lootSources.map((source) => source.botId)).toEqual(['bot-1', 'bot-2', 'bot-3', 'bot-4'])

    const afterAllDrops = advanceToElapsed(afterFourthDrop, 151)
    expect(afterAllDrops.lootSources.map((source) => source.botId)).toEqual([
      'bot-1',
      'bot-2',
      'bot-3',
      'bot-4',
      'bot-5',
      'bot-6',
    ])

    const finished = advanceToElapsed(afterAllDrops, 600)
    expect(finished.lootSources.map((source) => source.botId)).toEqual([
      'bot-1',
      'bot-2',
      'bot-3',
      'bot-4',
      'bot-5',
      'bot-6',
    ])
  })

  it('keeps dropped backpack contents directly enumerable and lootable', () => {
    const started = advanceTrainingRun(createTrainingRunState(catalog), { type: 'BEGIN_RUN', seed: 7 }, catalog)
    const afterFirstDrop = advanceTrainingRun(started, { type: 'ADVANCE_TIME', deltaSeconds: 1 }, catalog)
    const droppedBackpackId = afterFirstDrop.lootSources[0]?.itemIds.find((itemId) =>
      afterFirstDrop.inventory.itemInstances[itemId]?.itemDefinitionId === 'backpack-split',
    )

    expect(droppedBackpackId).toBeDefined()
    const droppedBackpackStorage = getStorageUnitForItem(afterFirstDrop.inventory, droppedBackpackId!)
    expect(droppedBackpackStorage).toBeDefined()
    expect(getChildItems(afterFirstDrop.inventory, droppedBackpackStorage!.id).length).toBeGreaterThan(0)
  })
})
