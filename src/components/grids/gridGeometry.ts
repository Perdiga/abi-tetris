import type {
  GridLayout,
  GridMask,
  GridRegion,
  InventoryItemRecord,
  SupportedRotation,
} from './types'

interface Cell {
  x: number
  y: number
}

export interface PlacementValidation {
  valid: boolean
  reason?: string
}

export function getMaskSize(mask: GridMask) {
  return {
    width: Math.max(...mask.map((row) => row.length), 0),
    height: mask.length,
  }
}

function normalizeMask(mask: GridMask) {
  const { width } = getMaskSize(mask)
  return mask.map((row) => row.padEnd(width, '0'))
}

export function rotateMask(mask: GridMask, rotation: SupportedRotation): GridMask {
  const normalized = normalizeMask(mask)

  switch (rotation) {
    case 0:
      return normalized
    case 90: {
      const rotated: string[] = []
      const width = normalized[0]?.length ?? 0

      for (let x = 0; x < width; x += 1) {
        let row = ''
        for (let y = normalized.length - 1; y >= 0; y -= 1) {
          row += normalized[y]?.[x] ?? '0'
        }
        rotated.push(row)
      }

      return rotated
    }
  }
}

export function getOccupiedCells(mask: GridMask): Cell[] {
  return mask.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === '1' ? [{ x, y }] : [])),
  )
}

export function getRegionById(layout: GridLayout, regionId: string) {
  return layout.regions.find((region) => region.id === regionId)
}

export function getLayoutById(layouts: readonly GridLayout[], layoutId: string) {
  return layouts.find((layout) => layout.id === layoutId)
}

function toCellKey(x: number, y: number) {
  return `${x}:${y}`
}

export function getRegionCellSet(region: GridRegion) {
  return new Set(
    getOccupiedCells(region.shapeMask).map(({ x, y }) => toCellKey(x, y)),
  )
}

export function getItemMask(item: InventoryItemRecord) {
  const rotation: SupportedRotation = item.rotation === 90 ? 90 : 0
  return rotateMask(item.shapeMask, rotation)
}

export function getItemBounds(item: InventoryItemRecord) {
  return getMaskSize(getItemMask(item))
}
