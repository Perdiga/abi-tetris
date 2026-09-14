import './EquipmentScreen.css'

import type { CSSProperties, Dispatch } from 'react'
import { useEffect, useMemo, useState } from 'react'

import operatorImage from '../../assets/operator.png'
import type { EquipmentSlotId, ItemCategory } from '../../data'
import {
  dropTrainingItemToGround,
  equipTrainingItem,
  extractTrainingRunNow,
  moveTrainingItem,
  selectAvailableItemStates,
  selectCurrentSecuredValue,
  selectEquipmentSlots,
  selectItem,
  selectOperationFeedback,
  selectPlayersRemaining,
  selectPlayerStorageUnits,
  selectProjectedScoreBreakdown,
  selectStorageUnit,
  selectTrainingTimer,
  setTrainingItemRotation,
  setTrainingItemState,
  type TrainingModeAction,
  type TrainingModeActionValidation,
  type TrainingModeStoreState,
  unequipTrainingItem,
  validateEquipTrainingItem,
  validateDropTrainingItemToGround,
  validateExtractTrainingRunNow,
  validateMoveTrainingItem,
  validateSetTrainingItemRotation,
  validateSetTrainingItemState,
  validateUnequipTrainingItem,
} from '../../state/training-mode'
import { CompartmentGrid } from '../grids/CompartmentGrid'
import { getItemBounds } from '../grids/gridGeometry'
import { flattenStorageUnitTree } from '../grids/storageTree'
import type { CellTarget, InventoryItemRecord, PlacementTarget } from '../grids/types'
import { toGridLayout } from '../grids/types'
import { GroundLootPanel } from '../ground-loot/GroundLootPanel'
import {
  getItemCounterLabel,
  getItemDescriptor,
  getItemGlyph,
  getItemStatusChip,
  getItemTint,
  getWeaponSlotBadge,
} from '../itemPresentation'
import { clsx } from '../utils/clsx'

const LEFT_RAIL_SLOT_IDS: readonly EquipmentSlotId[] = [
  'helmet',
  'helmetFaceShield',
  'mask',
  'primaryWeapon',
  'secondaryWeapon',
]
const RIGHT_RAIL_SLOT_IDS: readonly EquipmentSlotId[] = [
  'headset',
  'tacticalVest',
  'ballisticVest',
  'backpack',
  'pistol',
]

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  helmet: 'Helmet',
  face_shield: 'Face shield',
  mask: 'Mask',
  headset: 'Headset',
  weapon_primary: 'Primary weapon',
  weapon_secondary: 'Secondary weapon',
  weapon_pistol: 'Pistol',
  vest_tactical: 'Tactical vest',
  vest_ballistic: 'Ballistic vest',
  backpack: 'Backpack',
  ammo: 'Ammo',
  ammo_box: 'Ammo box',
  medkit: 'Medkit',
  consumable: 'Consumable',
  container_misc: 'Utility',
}

const getItemMeta = (item: InventoryItemRecord): string => {
  const bounds = getItemBounds(item)
  const parts = [`${bounds.width}×${bounds.height}`]

  if (item.currentDurability !== undefined) {
    parts.push(`${item.currentDurability}`)
  }

  if (item.uiStateLabel) {
    parts.push(item.uiStateLabel)
  }

  return parts.join(' • ')
}

const toPlacementValidation = (
  validation: TrainingModeActionValidation | null,
): { valid: boolean; reason?: string } | null =>
  validation ? { valid: validation.ok, reason: validation.ok ? undefined : validation.reason } : null

const buildUnequipAction = (item: InventoryItemRecord, target: CellTarget) =>
  unequipTrainingItem(
    item.itemInstanceId,
    target.storageUnitId,
    target.compartmentId,
    target.x,
    target.y,
    item.rotation,
  )

const buildMoveAction = (item: InventoryItemRecord, target: CellTarget) =>
  moveTrainingItem(
    item.itemInstanceId,
    target.storageUnitId,
    target.compartmentId,
    target.x,
    target.y,
    item.rotation,
  )

const describePlacement = (target: PlacementTarget): string =>
  target.kind === 'container'
    ? `moved into ${target.compartmentId}`
    : `equipped in ${target.slotId}`

const getSlotToneClass = (slotId: EquipmentSlotId): string | null => {
  if (slotId === 'primaryWeapon' || slotId === 'secondaryWeapon') {
    return 'equipment-screen__slot--weapon'
  }

  if (slotId === 'pistol') {
    return 'equipment-screen__slot--sidearm'
  }

  return null
}

interface EquipmentScreenProps {
  state: TrainingModeStoreState
  dispatch: Dispatch<TrainingModeAction>
}

interface SlotGroup {
  title: string
  slotIds: readonly EquipmentSlotId[]
  className?: string
}

export function EquipmentScreen({ state, dispatch }: EquipmentScreenProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState(
    'Select an item, then click any highlighted cell or compatible equipment slot to move it.',
  )

  const equipmentSlots = useMemo(() => selectEquipmentSlots(state), [state])
  const playerStorageUnits = useMemo(() => selectPlayerStorageUnits(state), [state])
  const timer = useMemo(() => selectTrainingTimer(state), [state])
  const playersRemaining = useMemo(() => selectPlayersRemaining(state), [state])
  const securedValue = useMemo(() => selectCurrentSecuredValue(state), [state])
  const projectedScore = useMemo(() => selectProjectedScoreBreakdown(state), [state])
  const operationFeedback = useMemo(() => selectOperationFeedback(state), [state])
  const selectedItem = useMemo(
    () => (selectedItemId ? selectItem(state, selectedItemId) ?? null : null),
    [state, selectedItemId],
  )
  const availableStates = useMemo(
    () => (selectedItem ? selectAvailableItemStates(state, selectedItem.itemInstanceId) : []),
    [state, selectedItem],
  )
  const visiblePlayerStorageUnits = useMemo(
    () =>
      flattenStorageUnitTree(playerStorageUnits, (storageUnitId) => selectStorageUnit(state, storageUnitId)),
    [playerStorageUnits, state],
  )

  useEffect(() => {
    if (selectedItemId && !selectedItem) {
      setSelectedItemId(null)
    }
  }, [selectedItem, selectedItemId])

  useEffect(() => {
    if (operationFeedback.lastError) {
      setStatusMessage(operationFeedback.lastError)
    }
  }, [operationFeedback.lastError])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'r' && event.key !== 'R') {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      event.preventDefault()
      handleRotateSelectedItem()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function getValidation(target: PlacementTarget) {
    if (!selectedItem) {
      return null
    }

    if (target.kind === 'equipment-slot') {
      return toPlacementValidation(
        validateEquipTrainingItem(state, equipTrainingItem(selectedItem.itemInstanceId, target.slotId)),
      )
    }

    return toPlacementValidation(
      selectedItem.equippedSlotId
        ? validateUnequipTrainingItem(state, buildUnequipAction(selectedItem, target))
        : validateMoveTrainingItem(state, buildMoveAction(selectedItem, target)),
    )
  }

  function getDropToGroundValidation(itemInstanceId: string | null) {
    if (!itemInstanceId) {
      return null
    }

    return toPlacementValidation(validateDropTrainingItemToGround(state, dropTrainingItemToGround(itemInstanceId)))
  }

  function handleItemSelect(itemId: string) {
    setSelectedItemId((current) => (current === itemId ? null : itemId))

    const clickedItem = selectItem(state, itemId)
    if (!clickedItem) {
      return
    }

    setStatusMessage(
      `Selected ${clickedItem.name}. Click a compatible slot or a valid highlighted cell to place it.`,
    )
  }

  function handlePlaceItem(target: PlacementTarget) {
    if (!selectedItem) {
      return
    }

    const validation = getValidation(target)
    if (!validation?.valid) {
      setStatusMessage(validation?.reason ?? 'Select an item before placing it.')
      return
    }

    dispatch(
      target.kind === 'equipment-slot'
        ? equipTrainingItem(selectedItem.itemInstanceId, target.slotId)
        : selectedItem.equippedSlotId
          ? buildUnequipAction(selectedItem, target)
          : buildMoveAction(selectedItem, target),
    )
    setStatusMessage(`${selectedItem.name} ${describePlacement(target)}.`)
    setSelectedItemId(null)
  }

  function handleDropToGround(itemInstanceId = selectedItemId) {
    if (!itemInstanceId) {
      setStatusMessage('Select an item before dropping it to the ground.')
      return
    }

    const item = selectItem(state, itemInstanceId)
    const validation = getDropToGroundValidation(itemInstanceId)

    if (!validation?.valid) {
      setStatusMessage(validation?.reason ?? 'This item cannot be dropped to the ground.')
      return
    }

    if (!item) {
      setStatusMessage(`Unknown item instance "${itemInstanceId}".`)
      setSelectedItemId(null)
      return
    }

    dispatch(dropTrainingItemToGround(itemInstanceId))
    setStatusMessage(`${item.name} dropped to the ground.`)
    setSelectedItemId(null)
  }

  function handleRotateSelectedItem() {
    if (!selectedItem?.allowRotation) {
      return
    }

    const nextRotation = selectedItem.rotation === 90 ? 0 : 90
    const action = setTrainingItemRotation(selectedItem.itemInstanceId, nextRotation)
    const validation = toPlacementValidation(validateSetTrainingItemRotation(state, action))

    if (!validation?.valid) {
      setStatusMessage(validation?.reason ?? 'This item cannot rotate right now.')
      return
    }

    dispatch(action)
    setStatusMessage(`${selectedItem.name} rotated to ${nextRotation}°.`)
  }

  function handleSetSelectedItemState(targetStateId: string) {
    if (!selectedItem) {
      return
    }

    const action = setTrainingItemState(selectedItem.itemInstanceId, targetStateId)
    const validation = toPlacementValidation(validateSetTrainingItemState(state, action))

    if (!validation?.valid) {
      setStatusMessage(validation?.reason ?? 'This state change is not allowed.')
      return
    }

    dispatch(action)
    const nextState = availableStates.find((candidate) => candidate.id === targetStateId)
    setStatusMessage(`${selectedItem.name} switched to ${nextState?.uiLabel ?? nextState?.label ?? targetStateId}.`)
  }

  function handleExtractNow() {
    const validation = toPlacementValidation(validateExtractTrainingRunNow(state))
    if (!validation?.valid) {
      setStatusMessage(validation?.reason ?? 'Extraction is unavailable.')
      return
    }

    dispatch(extractTrainingRunNow())
  }

  const slotGroups: readonly SlotGroup[] = [
    {
      title: 'Operator rig',
      slotIds: LEFT_RAIL_SLOT_IDS,
      className: 'equipment-screen__slots equipment-screen__slots--operator',
    },
  ] as const
  const rightRailSlots = equipmentSlots.filter((slot) => RIGHT_RAIL_SLOT_IDS.includes(slot.slotId))

  const nextBotLabel =
    timer.nextBotDeathAtSeconds !== undefined
      ? `${Math.max(0, Math.ceil(timer.nextBotDeathAtSeconds - timer.elapsedSeconds))}s`
      : 'Cleared'

  return (
    <div className="equipment-screen">
      <div className="equipment-screen__shell">
        <header className="equipment-screen__panel equipment-screen__header">
          <div className="equipment-screen__header-copy">
            <p className="equipment-screen__kicker">ABI Trainer //</p>
            <h1 className="equipment-screen__title">Loadout staging</h1>
            <p className="equipment-screen__subtitle">
              Tactical training HUD wired to the engine-backed run state. Every placement preview, loot
              drop, and score update still comes from the existing selectors and validators.
            </p>
          </div>

          <div className="equipment-screen__hud-readout">
            <span className="equipment-screen__header-pill-label">Time remaining</span>
            <span className="equipment-screen__header-pill-value">{timer.formattedRemaining}</span>
            <span className="equipment-screen__header-pill-meta" data-testid="players-remaining">
              {playersRemaining.remaining} / {playersRemaining.total} players remaining
            </span>
          </div>

          <div className="equipment-screen__hud-readout equipment-screen__hud-readout--accent">
            <span className="equipment-screen__header-pill-label">Equipment price</span>
            <span className="equipment-screen__header-pill-value" data-testid="secured-value">
              ${securedValue.toLocaleString()}
            </span>
            <span className="equipment-screen__header-pill-meta">Projected {projectedScore.medal}</span>
          </div>

            <button
              className=" equipment-screen__hud-readout equipment-screen__action equipment-screen__action--extract"
              onClick={handleExtractNow}
              type="button"
            >
              Extract Now
            </button>
          
        </header>

        <div className="equipment-screen__main">
          <aside className="equipment-screen__column">
            {slotGroups.map((group) => (
              <section key={group.title}>
                <div className={group.className ?? 'equipment-screen__slots'}>
                  {equipmentSlots
                    .filter((slot) => group.slotIds.includes(slot.slotId))
                    .map((slot) => {
                      const validation = getValidation({
                        kind: 'equipment-slot',
                        slotId: slot.slotId,
                      })

                      return (
                        <button
                          className={clsx(
                            'equipment-screen__slot',
                            getSlotToneClass(slot.slotId),
                            validation?.valid && 'equipment-screen__slot--valid',
                            validation && !validation.valid && 'equipment-screen__slot--invalid',
                          )}
                          key={slot.slotId}
                          onClick={() => handlePlaceItem({ kind: 'equipment-slot', slotId: slot.slotId })}
                          onDragOver={(event) => {
                            if (validation?.valid) {
                              event.preventDefault()
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            handlePlaceItem({ kind: 'equipment-slot', slotId: slot.slotId })
                          }}
                          type="button"
                        >
                          <span className="equipment-screen__slot-frame-label">{slot.label}</span>
                          {slot.item ? (
                            <span
                              className={clsx(
                                'equipment-screen__slot-item',
                                selectedItemId === slot.item.itemInstanceId && 'equipment-screen__slot-item--selected',
                              )}
                              data-testid={`slot-item-${slot.slotId}`}
                              draggable
                              onClick={(event) => {
                                event.stopPropagation()
                                handleItemSelect(slot.item!.itemInstanceId)
                              }}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move'
                                event.dataTransfer.setData('text/plain', slot.item!.itemInstanceId)
                                handleItemSelect(slot.item!.itemInstanceId)
                              }}
                              role="button"
                              style={
                                {
                                  '--item-tint': getItemTint(slot.item),
                                } as CSSProperties
                              }
                              tabIndex={0}
                            >
                              <span className="equipment-screen__slot-item-nameplate">{slot.item.name}</span>
                              <span className="equipment-screen__slot-item-art" aria-hidden="true">
                                {getItemGlyph(slot.item)}
                              </span>
                              {getItemStatusChip(slot.item) ? (
                                <span className="equipment-screen__slot-item-chip equipment-screen__slot-item-chip--top-right">
                                  {getItemStatusChip(slot.item)}
                                </span>
                              ) : null}
                              {getWeaponSlotBadge(slot.slotId) ? (
                                <span className="equipment-screen__slot-item-chip equipment-screen__slot-item-chip--badge">
                                  {getWeaponSlotBadge(slot.slotId)}
                                </span>
                              ) : null}
                              <span className="equipment-screen__slot-item-chip equipment-screen__slot-item-chip--bottom-left">
                                {getItemDescriptor(slot.item)}
                              </span>
                              <span className="equipment-screen__slot-item-chip equipment-screen__slot-item-chip--bottom-right">
                                {getItemCounterLabel(slot.item)}
                              </span>
                            </span>
                          ) : (
                            <span className="equipment-screen__slot-empty">
                              <span className="equipment-screen__slot-empty-icon" aria-hidden="true">
                                +
                              </span>
                              <span className="equipment-screen__slot-help">
                                {slot.acceptsCategories.map((category) => CATEGORY_LABELS[category]).join(' / ')}
                              </span>
                            </span>
                          )}
                        </button>
                      )
                    })}
                </div>
              </section>
            ))}
          </aside>

          <section className="equipment-screen__column equipment-screen__panel equipment-screen__silhouette">
            <div className="equipment-screen__mannequin">
              <div className="equipment-screen__operator-stage">
                <img
                  src={operatorImage}
                  alt="Operator loadout preview"
                  className="equipment-screen__operator-image"
                />
              </div>              
            </div>
          </section>

          <section className="equipment-screen__column">
            <section>
              <section className="equipment-screen__pockets" aria-label="Pockets">
                <h3 className="equipment-screen__section-title">Pockets</h3>
                <div className="equipment-screen__pockets-grid">
                  {[1, 2, 3, 4].map((slotNumber) => (
                    <span
                      aria-label={`Pocket slot ${slotNumber}`}
                      className="equipment-screen__pocket-slot"
                      data-testid={`pocket-slot-${slotNumber}`}
                      key={slotNumber}
                    />
                  ))}
                </div>
              </section>

              <div className="equipment-screen__slots equipment-screen__slots--quick">
                {rightRailSlots.map((slot) => {
                  const validation = getValidation({
                    kind: 'equipment-slot',
                    slotId: slot.slotId,
                  })

                  return (
                    <button
                      className={clsx(
                        'equipment-screen__slot',
                        validation?.valid && 'equipment-screen__slot--valid',
                        validation && !validation.valid && 'equipment-screen__slot--invalid',
                      )}
                      data-testid={`slot-target-${slot.slotId}`}
                      key={slot.slotId}
                      onClick={() => handlePlaceItem({ kind: 'equipment-slot', slotId: slot.slotId })}
                      onDragOver={(event) => {
                        if (validation?.valid) {
                          event.preventDefault()
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        handlePlaceItem({ kind: 'equipment-slot', slotId: slot.slotId })
                      }}
                      type="button"
                    >
                      <span className="equipment-screen__slot-frame-label">{slot.label}</span>
                      {slot.item ? (
                        <span className="equipment-screen__slot-empty">
                          <span className="equipment-screen__slot-help">{slot.item.name}</span>
                        </span>
                      ) : (
                        <span className="equipment-screen__slot-empty">
                          <span className="equipment-screen__slot-empty-icon" aria-hidden="true">
                            +
                          </span>
                          <span className="equipment-screen__slot-help">
                            {slot.acceptsCategories.map((category) => CATEGORY_LABELS[category]).join(' / ')}
                          </span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            <div className="equipment-screen__storage-stack">
              {visiblePlayerStorageUnits.map(({ storageUnit, depth }) => (
                <div
                  className="equipment-screen__storage-node"
                  key={storageUnit.storageUnitId}
                  style={{ '--storage-depth': `${depth * 14}px` } as CSSProperties}
                >
                  {storageUnit.sourceItem ? (
                    <button
                      className={clsx(
                        'equipment-screen__storage-source',
                        selectedItemId === storageUnit.sourceItem.itemInstanceId &&
                          'equipment-screen__storage-source--selected',
                      )}
                      data-testid={
                        storageUnit.sourceItem.equippedSlotId
                          ? `slot-item-${storageUnit.sourceItem.equippedSlotId}`
                          : `storage-source-${storageUnit.sourceItem.itemInstanceId}`
                      }
                      onClick={() => handleItemSelect(storageUnit.sourceItem!.itemInstanceId)}
                      style={
                        {
                          '--item-tint': getItemTint(storageUnit.sourceItem),
                        } as CSSProperties
                      }
                      type="button"
                    >
                      <span className="equipment-screen__storage-source-nameplate">
                        {storageUnit.sourceItem.name}
                      </span>
                      <span className="equipment-screen__storage-source-art" aria-hidden="true">
                        {getItemGlyph(storageUnit.sourceItem)}
                      </span>
                      <span className="equipment-screen__storage-source-footer">
                        <strong>{storageUnit.layoutName}</strong>
                        <span>{getItemCounterLabel(storageUnit.sourceItem)}</span>
                      </span>
                    </button>
                  ) : null}

                  <CompartmentGrid
                    getPlacementValidation={(target) => getValidation(target)}
                    items={storageUnit.compartments.flatMap((compartment) => compartment.items)}
                    layout={toGridLayout(storageUnit)}
                    onItemSelect={handleItemSelect}
                    onPlaceItem={handlePlaceItem}
                    selectedItem={selectedItem}
                    selectedItemId={selectedItemId}
                  />
                </div>
              ))}
            </div>
          </section>

          <aside className="equipment-screen__column equipment-screen__ground-column">
            <GroundLootPanel
              getPlacementValidation={(target) => getValidation(target)}
              onDropToGround={handleDropToGround}
              onItemSelect={handleItemSelect}
              onPlaceItem={handlePlaceItem}
              selectedItem={selectedItem}
              selectedItemId={selectedItemId}
              state={state}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
