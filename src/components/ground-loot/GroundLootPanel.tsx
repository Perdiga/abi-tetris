import './GroundLootPanel.css'

import type { CSSProperties } from 'react'
import { useMemo } from 'react'

import {
  selectLootSourceStorageUnits,
  selectLootSources,
  selectStorageUnit,
  type TrainingModeStoreState,
} from '../../state/training-mode'
import { flattenStorageUnitTree } from '../grids/storageTree'
import type { CellTarget, InventoryItemRecord } from '../grids/types'
import { getItemCounterLabel, getItemDescriptor, getItemGlyph, getItemTint } from '../itemPresentation'
import { clsx } from '../utils/clsx'

interface GroundLootPanelProps {
  state: TrainingModeStoreState
  selectedItemId: string | null
  selectedItem: InventoryItemRecord | null
  onDropToGround: (itemId?: string) => void
  onItemSelect: (itemId: string) => void
  onPlaceItem: (target: CellTarget) => void
  getPlacementValidation: (target: CellTarget) => { valid: boolean; reason?: string } | null
}

const formatValueLabel = (baseValue: number) => `Approx. value $${baseValue.toLocaleString()}`

export function GroundLootPanel(props: GroundLootPanelProps) {
  const { state, selectedItemId, onDropToGround, onItemSelect } = props
  const lootSources = useMemo(() => selectLootSources(state), [state])

  const groundLootItems = useMemo(() => {
    const seen = new Set<string>()
    const items: InventoryItemRecord[] = []

    const pushItem = (item?: InventoryItemRecord) => {
      if (!item || seen.has(item.itemInstanceId)) {
        return
      }

      seen.add(item.itemInstanceId)
      items.push(item)
    }

    lootSources.forEach((lootSource) => {
      lootSource.topLevelItems.forEach(pushItem)

      const rootStorageUnits = selectLootSourceStorageUnits(state, lootSource.lootSourceId)
      const storageTree = flattenStorageUnitTree(rootStorageUnits, (storageUnitId) => selectStorageUnit(state, storageUnitId))

      storageTree.forEach(({ storageUnit }) => {
        pushItem(storageUnit.sourceItem)
        storageUnit.compartments.forEach((compartment) => {
          compartment.items.forEach(pushItem)
        })
      })
    })

    return items
  }, [lootSources, state])

  return (
    <section className="ground-loot-panel__stash">
      <header className="ground-loot-panel__header">
        <div>
          <p className="ground-loot-panel__kicker">Ground stash</p>
        </div>
        <span className="ground-loot-panel__badge">{groundLootItems.length} items</span>
      </header>

      <div
        className={clsx('ground-loot-panel__grid', groundLootItems.length === 0 && 'ground-loot-panel__grid--empty')}
        data-testid="ground-loot-grid"
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const itemInstanceId = event.dataTransfer.getData('text/plain') || selectedItemId || undefined
          onDropToGround(itemInstanceId)
        }}
      >
        {groundLootItems.length === 0 ? (
          <div className="ground-loot-panel__empty-state">
            <p className="ground-loot-panel__empty-title">Loot feed offline</p>
            <p className="ground-loot-panel__empty-copy">Loot drops will pack into this unified grid as bots die.</p>
          </div>
        ) : (
          groundLootItems.map((item) => {
            const tooltipId = `ground-loot-tooltip-${item.itemInstanceId}`

            return (
              <div className="ground-loot-panel__tile" key={item.itemInstanceId}>
                <button
                  aria-describedby={tooltipId}
                  className={clsx(
                    'ground-loot-panel__item-card',
                    selectedItemId === item.itemInstanceId && 'ground-loot-panel__item-card--selected',
                  )}
                  data-testid={`item-${item.itemInstanceId}`}
                  draggable
                  onClick={() => onItemSelect(item.itemInstanceId)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.itemInstanceId)
                    onItemSelect(item.itemInstanceId)
                  }}
                  style={{ '--item-tint': getItemTint(item) } as CSSProperties}
                  type="button"
                >
                  <span className="ground-loot-panel__item-nameplate">{item.name}</span>
                  <span className="ground-loot-panel__item-art" aria-hidden="true">
                    {getItemGlyph(item)}
                  </span>
                  <span className="ground-loot-panel__item-meta">{getItemDescriptor(item)}</span>
                  <span className="ground-loot-panel__item-count">{getItemCounterLabel(item)}</span>
                </button>

                <div className="ground-loot-panel__tooltip" id={tooltipId} role="tooltip">
                  <p className="ground-loot-panel__tooltip-title">{item.name}</p>
                  <p className="ground-loot-panel__tooltip-row">
                    <span aria-hidden="true">{getItemGlyph(item)}</span>
                    <span>{formatValueLabel(item.baseValue)}</span>
                  </p>
                  <p className="ground-loot-panel__tooltip-hint">Click or drag to move</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
