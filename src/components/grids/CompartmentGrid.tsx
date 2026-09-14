import './CompartmentGrid.css'

import type { CSSProperties } from 'react'

import {
  getItemCounterLabel,
  getItemDescriptor,
  getItemGlyph,
  getItemStatusChip,
  getItemTint,
} from '../itemPresentation'
import { clsx } from '../utils/clsx'
import { getItemBounds, getItemMask, getRegionById, getRegionCellSet } from './gridGeometry'
import type { CellTarget, GridLayout, InventoryItemRecord } from './types'

interface PlacementValidation {
  valid: boolean
  reason?: string
}

interface CompartmentGridProps {
  layout: GridLayout
  items: readonly InventoryItemRecord[]
  selectedItemId: string | null
  selectedItem: InventoryItemRecord | null
  onItemSelect: (itemId: string) => void
  onPlaceItem: (target: CellTarget) => void
  getPlacementValidation?: (target: CellTarget) => PlacementValidation | null
}

const countMaskCells = (mask: readonly string[]) =>
  mask.reduce((total, row) => total + [...row].filter((cell) => cell === '1').length, 0)

export function CompartmentGrid({
  layout,
  items,
  selectedItemId,
  selectedItem,
  onItemSelect,
  onPlaceItem,
  getPlacementValidation,
}: CompartmentGridProps) {
  const totalCapacity = layout.regions.reduce((sum, region) => sum + countMaskCells(region.shapeMask), 0)
  const usedCapacity = items.reduce((sum, record) => sum + countMaskCells(getItemMask(record)), 0)

  return (
    <section className="inventory-panel">
      <header className="inventory-panel__header">
        <div>
          <p className="inventory-panel__kicker">Armazenamento</p>
          <h3 className="inventory-panel__title">{layout.label}</h3>
          <p className="inventory-panel__subtitle">
            {usedCapacity}/{totalCapacity} slots used • {layout.regions.length} compartment
            {layout.regions.length === 1 ? '' : 's'}
          </p>
        </div>
        <span className="inventory-panel__badge">
          {layout.width}×{layout.height}
        </span>
      </header>

      <div
        aria-label={layout.label}
        className="compartment-grid"
        data-testid={`grid-${layout.testId ?? layout.id}`}
        role="grid"
        style={
          {
            '--grid-columns': String(layout.width),
            '--grid-rows': String(layout.height),
          } as CSSProperties
        }
      >
        {layout.regions.map((region) => {
          const validCells = getRegionCellSet(region)
          const regionCells = Array.from(validCells, (value) => {
            const [x, y] = value.split(':').map(Number)
            return { x, y }
          })

          return (
            <div key={region.id}>
              <div
                className="compartment-grid__region-label"
                style={
                  {
                    '--region-accent': region.accent,
                    left: `calc(${region.originX} * var(--cell-size))`,
                    top: `calc(${region.originY} * var(--cell-size) - 0.65rem)`,
                  } as CSSProperties
                }
              >
                {region.label}
              </div>

              {regionCells.map((cell) => {
                const target: CellTarget = {
                  kind: 'container',
                  storageUnitId: layout.id,
                  compartmentId: region.id,
                  x: cell.x,
                  y: cell.y,
                }

                const validation = selectedItem === null ? null : getPlacementValidation?.(target) ?? null

                const isSelectedOrigin =
                  selectedItem?.parentStorageUnitId === layout.id &&
                  selectedItem?.parentCompartmentId === region.id &&
                  selectedItem?.gridX === cell.x &&
                  selectedItem?.gridY === cell.y

                return (
                  <div
                    aria-label={`${layout.label} ${region.label} cell ${cell.x + 1}, ${cell.y + 1}`}
                    className={clsx(
                      'compartment-grid__cell',
                      validation?.valid && 'compartment-grid__cell--valid',
                      validation && !validation.valid && 'compartment-grid__cell--invalid',
                      isSelectedOrigin && 'compartment-grid__cell--valid',
                    )}
                    data-testid={`cell-${layout.testId ?? layout.id}-${region.id}-${cell.x}-${cell.y}`}
                    key={`${region.id}-${cell.x}-${cell.y}`}
                    onClick={() => onPlaceItem(target)}
                    onDragOver={(event) => {
                      if (validation?.valid) {
                        event.preventDefault()
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      onPlaceItem(target)
                    }}
                    role="gridcell"
                    style={
                      {
                        '--region-fill': `color-mix(in srgb, ${region.accent} 10%, #141519)`,
                        left: `calc(${region.originX + cell.x} * var(--cell-size))`,
                        top: `calc(${region.originY + cell.y} * var(--cell-size))`,
                        width: 'var(--cell-size)',
                        height: 'var(--cell-size)',
                      } as CSSProperties
                    }
                    tabIndex={0}
                  />
                )
              })}
            </div>
          )
        })}

        {items.map((record) => {
          const region = record.parentCompartmentId ? getRegionById(layout, record.parentCompartmentId) : undefined
          if (!region) {
            return null
          }

          const bounds = getItemBounds(record)
          const mask = getItemMask(record)
          const statusChip = getItemStatusChip(record)

          return (
            <button
              className={clsx(
                'compartment-grid__item',
                selectedItemId === record.itemInstanceId && 'compartment-grid__item--selected',
              )}
              data-testid={`item-${record.itemInstanceId}`}
              draggable
              key={record.itemInstanceId}
              onClick={() => onItemSelect(record.itemInstanceId)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', record.itemInstanceId)
                onItemSelect(record.itemInstanceId)
              }}
              style={
                {
                  '--item-tint': getItemTint(record),
                  left: `calc(${region.originX + (record.gridX ?? 0)} * var(--cell-size))`,
                  top: `calc(${region.originY + (record.gridY ?? 0)} * var(--cell-size))`,
                  width: `calc(${bounds.width} * var(--cell-size))`,
                  height: `calc(${bounds.height} * var(--cell-size))`,
                } as CSSProperties
              }
              type="button"
            >
              <span className="compartment-grid__item-nameplate">{record.name}</span>
              {statusChip ? (
                <span className="compartment-grid__item-chip compartment-grid__item-chip--top-right">
                  {statusChip}
                </span>
              ) : null}
              <span className="compartment-grid__item-art" aria-hidden="true">
                {getItemGlyph(record)}
              </span>
              <span className="compartment-grid__item-chip compartment-grid__item-chip--bottom-left">
                {getItemDescriptor(record)}
              </span>
              <span className="compartment-grid__item-chip compartment-grid__item-chip--bottom-right">
                {getItemCounterLabel(record)}
              </span>
              <div
                className="compartment-grid__footprint"
                style={
                  {
                    gridTemplateColumns: `repeat(${bounds.width}, 1fr)`,
                  } as CSSProperties
                }
              >
                {mask.flatMap((row, rowIndex) =>
                  [...row].map((cell, cellIndex) => (
                    <span
                      className={clsx(
                        'compartment-grid__footprint-cell',
                        cell !== '1' && 'compartment-grid__footprint-cell--empty',
                      )}
                      key={`${record.itemInstanceId}-${rowIndex}-${cellIndex}`}
                    />
                  )),
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
