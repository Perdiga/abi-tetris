import {
  createCatalogIndex,
  playerStarterLoadout,
  trainingBotLoadoutPool,
  type BotContainerPlacementTemplate,
  type BotLoadoutTemplate,
  type BotRosterEntry,
  type CatalogIndex,
  type EquipmentSlotId,
  type InventoryState,
  type LootSource,
  type ScoreBreakdown,
  type TrainingRunEvent,
  type TrainingRunPlayerAction,
  type TrainingRunState,
} from '../../data'
import {
  addItemInstance,
  cloneInventoryState,
  collectSecuredScorableItemIds,
  createEmptyInventoryState,
  createItemInstance,
  equipItemToSlot,
  getChildItems,
  getStorageUnitForItem,
  placeItemInStorage,
} from '../inventory'

const defaultCatalog = createCatalogIndex()

const createSeededRng = (seed: number) => {
  let value = seed >>> 0

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

const pushPhase = (phaseHistory: string[], phase: string): string[] =>
  phaseHistory.at(-1) === phase ? phaseHistory : [...phaseHistory, phase]

export const PLAYER_DROP_LOOT_SOURCE_ID = 'loot-source-player-drop'

export const createTrainingRunState = (catalog: CatalogIndex = defaultCatalog): TrainingRunState => ({
  definitionId: 'training-mode-v1',
  phase: 'PreRun',
  elapsedSeconds: 0,
  inventory: createEmptyInventoryState(catalog),
  botRoster: [],
  pendingBotDeaths: [],
  lootSources: [],
  phaseHistory: ['PreRun'],
})

export const advanceTrainingRun = (
  state: TrainingRunState,
  event: TrainingRunEvent,
  catalog: CatalogIndex = defaultCatalog,
): TrainingRunState => {
  switch (event.type) {
    case 'BEGIN_RUN':
      return state.phase === 'PreRun' ? loadRunData(state, catalog, event.seed) : state
    case 'ADVANCE_TIME':
      return event.deltaSeconds <= 0 ? state : advanceRunTime(state, event.deltaSeconds, catalog, event.queuedAction)
    case 'EXTRACT_NOW':
      return resolvePlayerAction(state, event, catalog)
  }
}

export const getScoringElapsedSeconds = (elapsedSeconds: number): number => Math.floor(elapsedSeconds)

export const getTimePenaltyMultiplier = (elapsedSeconds: number, catalog: CatalogIndex = defaultCatalog): number => {
  const definition = catalog.runDefinitionsById['training-mode-v1']
  const scoringElapsedSeconds = getScoringElapsedSeconds(elapsedSeconds)
  return definition.timePenaltyBands.find((band) => scoringElapsedSeconds <= band.maxElapsedSeconds)?.multiplier ?? 0.5
}

export const scoreTrainingRun = (
  inventory: InventoryState,
  elapsedSeconds: number,
  catalog: CatalogIndex = defaultCatalog,
): ScoreBreakdown => {
  const grossScore = collectSecuredScorableItemIds(inventory, catalog).reduce((score, itemId) => {
    const item = inventory.itemInstances[itemId]
    const definition = item ? catalog.itemDefinitionsById[item.itemDefinitionId] : undefined
    return score + (definition?.baseValue ?? 0)
  }, 0)
  const scoringElapsedSeconds = getScoringElapsedSeconds(elapsedSeconds)
  const timePenaltyMultiplier = getTimePenaltyMultiplier(elapsedSeconds, catalog)
  const finalScore = multiplyScoreByPenalty(grossScore, timePenaltyMultiplier)
  const medal =
    catalog.runDefinitionsById['training-mode-v1'].medalThresholds.find(
      (threshold) => finalScore >= threshold.minimumScore,
    )?.medal ?? 'No Medal'

  return {
    grossScore,
    elapsedSeconds,
    scoringElapsedSeconds,
    timePenaltyMultiplier,
    finalScore,
    medal,
  }
}

const multiplyScoreByPenalty = (grossScore: number, multiplier: number): number => {
  const multiplierText = multiplier.toString()

  if (!multiplierText.includes('.')) {
    return grossScore * multiplier
  }

  const decimalPlaces = multiplierText.split('.')[1]?.length ?? 0
  const scale = 10 ** decimalPlaces
  const scaledMultiplier = Math.round(multiplier * scale)
  return Math.floor((grossScore * scaledMultiplier) / scale)
}

const loadRunData = (
  state: TrainingRunState,
  catalog: CatalogIndex,
  seed = Date.now(),
): TrainingRunState => {
  const definition = catalog.runDefinitionsById[state.definitionId]
  const rng = createSeededRng(seed)
  let inventory = createEmptyInventoryState(catalog)
  inventory = seedLoadout(inventory, playerStarterLoadout, 'player', catalog, 'player').inventory

  const botRoster: BotRosterEntry[] = []

  definition.botDeathSchedule.forEach((_, index) => {
    const botId = `bot-${index + 1}`
    const template = trainingBotLoadoutPool[Math.floor(rng() * trainingBotLoadoutPool.length)] as BotLoadoutTemplate
    const seeded = seedLoadout(inventory, template, botId, catalog, botId)
    inventory = seeded.inventory
    botRoster.push({ botId, topLevelItemIds: seeded.topLevelItemIds, dropped: false })
  })

  return {
    ...state,
    phase: 'RunActive',
    activePhase: 'AwaitNextBotDeath',
    inventory,
    botRoster,
    pendingBotDeaths: definition.botDeathSchedule.map((atSeconds, index) => ({
      botId: `bot-${index + 1}`,
      atSeconds,
    })),
    lootSources: [],
    phaseHistory: ['PreRun', 'LoadRunData', 'RunActive:AwaitNextBotDeath'],
  }
}

const advanceRunTime = (
  state: TrainingRunState,
  deltaSeconds: number,
  catalog: CatalogIndex,
  queuedAction?: TrainingRunPlayerAction,
): TrainingRunState => {
  if (state.phase !== 'RunActive') {
    return state
  }

  const definition = catalog.runDefinitionsById[state.definitionId]
  const nextElapsed = Math.min(definition.durationSeconds, state.elapsedSeconds + deltaSeconds)
  let nextState: TrainingRunState = {
    ...state,
    elapsedSeconds: nextElapsed,
    activePhase: 'AwaitNextBotDeath',
    phaseHistory: pushPhase(state.phaseHistory, 'RunActive:AwaitNextBotDeath'),
  }

  if (queuedAction) {
    nextState = resolvePlayerAction(nextState, queuedAction, catalog)
    if (nextState.phase !== 'RunActive') {
      return nextState
    }
  }

  while (nextState.pendingBotDeaths[0] && nextState.pendingBotDeaths[0]!.atSeconds <= nextElapsed) {
    nextState = spawnLootDrop(nextState, nextState.pendingBotDeaths[0]!.botId)
  }

  if (nextElapsed >= definition.durationSeconds) {
    return finalizeRun(nextState, 'time-cap', definition.durationSeconds, catalog)
  }

  return nextState
}

const resolvePlayerAction = (
  state: TrainingRunState,
  action: TrainingRunPlayerAction,
  catalog: CatalogIndex,
): TrainingRunState => {
  if (state.phase !== 'RunActive') {
    return state
  }

  switch (action.type) {
    case 'EXTRACT_NOW':
      return finalizeRun(
        {
          ...state,
          activePhase: 'ExtractNow',
          phaseHistory: pushPhase(state.phaseHistory, 'RunActive:ExtractNow'),
        },
        'extract',
        state.elapsedSeconds,
        catalog,
      )
  }
}

const finalizeRun = (
  state: TrainingRunState,
  runEndReason: 'extract' | 'time-cap',
  scoringElapsedSeconds: number,
  catalog: CatalogIndex,
): TrainingRunState => {
  const score = scoreTrainingRun(state.inventory, scoringElapsedSeconds, catalog)

  return {
    ...state,
    phase: 'ResultsScreen',
    activePhase: undefined,
    runEndReason,
    score,
    phaseHistory: [...state.phaseHistory, 'RunEnd', 'ScoreRun', 'ResultsScreen'],
  }
}

const spawnLootDrop = (state: TrainingRunState, botId: string): TrainingRunState => {
  const rosterEntry = state.botRoster.find((entry) => entry.botId === botId)

  if (!rosterEntry || rosterEntry.dropped) {
    return state
  }

  const inventory = cloneInventoryState(state.inventory)
  const lootSourceId = `loot-source-${botId}`
  const droppedItemIds: string[] = []
  const spawnedAtSeconds = state.pendingBotDeaths[0]?.atSeconds ?? state.elapsedSeconds

  for (const itemId of rosterEntry.topLevelItemIds) {
    const item = inventory.itemInstances[itemId]

    if (!item) {
      continue
    }

    droppedItemIds.push(itemId)
    inventory.itemInstances[itemId] = {
      ...item,
      ownerEntityId: lootSourceId,
      equippedSlotId: undefined,
      parentStorageUnitId: undefined,
      parentCompartmentId: undefined,
      gridX: undefined,
      gridY: undefined,
    }
    reassignSubtreeOwners(inventory, itemId, lootSourceId)
  }

  const lootSource: LootSource = {
    id: lootSourceId,
    botId,
    label: `Loot from ${botId}`,
    spawnedAtSeconds,
    itemIds: droppedItemIds,
  }

  return {
    ...state,
    inventory,
    lootSources: [...state.lootSources, lootSource],
    botRoster: state.botRoster.map((entry) => (entry.botId === botId ? { ...entry, dropped: true } : entry)),
    pendingBotDeaths: state.pendingBotDeaths.slice(1),
    activePhase: 'PlayerLooting',
    phaseHistory: pushPhase(pushPhase(state.phaseHistory, 'RunActive:SpawnLootDrop'), 'RunActive:PlayerLooting'),
  }
}

export const dropItemToGround = (
  state: TrainingRunState,
  itemInstanceId: string,
  currentElapsedSeconds: number,
): TrainingRunState => {
  const item = state.inventory.itemInstances[itemInstanceId]

  if (
    !item ||
    item.ownerEntityId !== 'player' ||
    (item.equippedSlotId === undefined && item.parentStorageUnitId === undefined)
  ) {
    return state
  }

  const inventory = cloneInventoryState(state.inventory)
  const previousEquippedSlotId = item.equippedSlotId
  inventory.itemInstances[itemInstanceId] = {
    ...inventory.itemInstances[itemInstanceId]!,
    ownerEntityId: PLAYER_DROP_LOOT_SOURCE_ID,
    equippedSlotId: undefined,
    parentStorageUnitId: undefined,
    parentCompartmentId: undefined,
    gridX: undefined,
    gridY: undefined,
  }
  if (previousEquippedSlotId) {
    inventory.equipment[previousEquippedSlotId] = null
  }
  reassignSubtreeOwners(inventory, itemInstanceId, PLAYER_DROP_LOOT_SOURCE_ID)

  const existingLootSource = state.lootSources.find((lootSource) => lootSource.id === PLAYER_DROP_LOOT_SOURCE_ID)
  const lootSources = existingLootSource
    ? state.lootSources.map((lootSource) =>
        lootSource.id === PLAYER_DROP_LOOT_SOURCE_ID
          ? { ...lootSource, itemIds: [...lootSource.itemIds, itemInstanceId] }
          : lootSource,
      )
    : [
        ...state.lootSources,
        {
          id: PLAYER_DROP_LOOT_SOURCE_ID,
          botId: 'player-drop',
          label: 'Dropped Gear',
          spawnedAtSeconds: currentElapsedSeconds,
          itemIds: [itemInstanceId],
        },
      ]

  return {
    ...state,
    inventory,
    lootSources,
  }
}

const reassignSubtreeOwners = (inventory: InventoryState, itemInstanceId: string, ownerEntityId: string): void => {
  const item = inventory.itemInstances[itemInstanceId]

  if (!item) {
    return
  }

  inventory.itemInstances[itemInstanceId] = { ...item, ownerEntityId }
  const storageUnit = getStorageUnitForItem(inventory, itemInstanceId)

  if (storageUnit) {
    inventory.storageUnits[storageUnit.id] = { ...storageUnit, ownerEntityId }
    getChildItems(inventory, storageUnit.id).forEach((child) => reassignSubtreeOwners(inventory, child.id, ownerEntityId))
  }
}

const seedLoadout = (
  startingInventory: InventoryState,
  template: {
    equipment: Partial<Record<EquipmentSlotId, string>>
    backpackContents?: readonly BotContainerPlacementTemplate[]
    tacticalVestContents?: readonly BotContainerPlacementTemplate[]
    ballisticVestContents?: readonly BotContainerPlacementTemplate[]
  },
  ownerEntityId: string,
  catalog: CatalogIndex,
  idPrefix: string,
): { inventory: InventoryState; topLevelItemIds: string[] } => {
  let inventory = startingInventory
  const topLevelItemIds: string[] = []
  const equippedBySlot: Partial<Record<EquipmentSlotId, string>> = {}

  for (const [slotId, definitionId] of Object.entries(template.equipment) as Array<[EquipmentSlotId, string]>) {
    const item = createItemInstance(definitionId, catalog, {
      id: `${idPrefix}-${slotId}`,
      ownerEntityId,
    })
    inventory = addItemInstance(inventory, item, catalog)
    topLevelItemIds.push(item.id)
    equippedBySlot[slotId] = item.id

    if (ownerEntityId !== 'player') {
      continue
    }

    const equipped = equipItemToSlot(inventory, item.id, slotId, catalog)

    if (equipped.ok) {
      inventory = equipped.state
    }
  }

  inventory = seedContainerContents(
    inventory,
    equippedBySlot.backpack,
    template.backpackContents,
    ownerEntityId,
    catalog,
    `${idPrefix}-backpack`,
  )
  inventory = seedContainerContents(
    inventory,
    equippedBySlot.tacticalVest,
    template.tacticalVestContents,
    ownerEntityId,
    catalog,
    `${idPrefix}-tactical-vest`,
  )
  inventory = seedContainerContents(
    inventory,
    equippedBySlot.ballisticVest,
    template.ballisticVestContents,
    ownerEntityId,
    catalog,
    `${idPrefix}-ballistic-vest`,
  )
  inventory = seedContainerContents(
    inventory,
    equippedBySlot.pockets,
    undefined,
    ownerEntityId,
    catalog,
    `${idPrefix}-pockets`,
  )

  return { inventory, topLevelItemIds }
}

const seedContainerContents = (
  startingInventory: InventoryState,
  containerItemId: string | undefined,
  placements: readonly BotContainerPlacementTemplate[] | undefined,
  ownerEntityId: string,
  catalog: CatalogIndex,
  idPrefix: string,
): InventoryState => {
  if (!containerItemId || !placements || placements.length === 0) {
    return startingInventory
  }

  const storageUnit = getStorageUnitForItem(startingInventory, containerItemId)

  if (!storageUnit) {
    return startingInventory
  }

  let inventory = startingInventory

  placements.forEach((placement, index) => {
    const item = createItemInstance(placement.definitionId, catalog, {
      id: `${idPrefix}-item-${index}`,
      ownerEntityId,
    })
    inventory = addItemInstance(inventory, item, catalog)
    const moved = placeItemInStorage(
      inventory,
      {
        itemInstanceId: item.id,
        targetStorageUnitId: storageUnit.id,
        targetCompartmentId: placement.targetCompartmentId,
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
      },
      catalog,
    )

    if (moved.ok) {
      inventory = moved.state
    }
  })

  return inventory
}
