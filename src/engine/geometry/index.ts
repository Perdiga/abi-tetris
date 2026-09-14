import type { ContainerCompartmentDefinition, ContainerLayoutDefinition, Rotation, ShapeMask } from '../../data'

export interface CellCoordinate {
  x: number
  y: number
}

export type PlacementValidationReason =
  | 'out-of-bounds'
  | 'crosses-compartment-boundary'
  | 'overlap'
  | 'unsupported-rotation'

export interface PlacementValidationResult {
  isValid: boolean
  occupiedCells: CellCoordinate[]
  reasons: PlacementValidationReason[]
}

export const getMaskDimensions = (shapeMask: ShapeMask) => ({
  width: shapeMask[0]?.length ?? 0,
  height: shapeMask.length,
})

export const getOccupiedCells = (shapeMask: ShapeMask): CellCoordinate[] => {
  const occupiedCells: CellCoordinate[] = []

  shapeMask.forEach((row, y) => {
    row.split('').forEach((cell, x) => {
      if (cell === '1') {
        occupiedCells.push({ x, y })
      }
    })
  })

  return occupiedCells
}

export const rotateMask = (shapeMask: ShapeMask, rotation: Rotation): string[] => {
  if (rotation === 0) {
    return [...shapeMask]
  }

  const { width, height } = getMaskDimensions(shapeMask)
  const occupied = getOccupiedCells(shapeMask)
  const rotatedDimensions = rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }
  const rows = Array.from({ length: rotatedDimensions.height }, () =>
    Array.from({ length: rotatedDimensions.width }, () => '0'),
  )

  for (const cell of occupied) {
    let nextX = cell.x
    let nextY = cell.y

    switch (rotation) {
      case 90:
        nextX = height - 1 - cell.y
        nextY = cell.x
        break
      case 180:
        nextX = width - 1 - cell.x
        nextY = height - 1 - cell.y
        break
      case 270:
        nextX = cell.y
        nextY = width - 1 - cell.x
        break
    }

    rows[nextY]![nextX] = '1'
  }

  return rows.map((row) => row.join(''))
}

export const isSupportedRotationV1 = (rotation: Rotation): rotation is 0 | 90 => rotation === 0 || rotation === 90

export const isOccupiedMaskCell = (shapeMask: ShapeMask, x: number, y: number): boolean =>
  y >= 0 && y < shapeMask.length && x >= 0 && x < (shapeMask[y]?.length ?? 0) && shapeMask[y]?.[x] === '1'

export const validatePlacement = ({
  itemMask,
  rotation,
  compartment,
  position,
  occupiedCells = [],
  layout,
}: {
  itemMask: ShapeMask
  rotation: Rotation
  compartment: ContainerCompartmentDefinition
  position: CellCoordinate
  occupiedCells?: readonly CellCoordinate[]
  layout?: ContainerLayoutDefinition
}): PlacementValidationResult => {
  if (!isSupportedRotationV1(rotation)) {
    return {
      isValid: false,
      occupiedCells: [],
      reasons: ['unsupported-rotation'],
    }
  }

  const rotatedMask = rotateMask(itemMask, rotation)
  const cells = getOccupiedCells(rotatedMask).map((cell) => ({
    x: cell.x + position.x,
    y: cell.y + position.y,
  }))
  const reasonSet = new Set<PlacementValidationReason>()
  const occupiedKeys = new Set(occupiedCells.map((cell) => `${cell.x}:${cell.y}`))

  for (const cell of cells) {
    const isOutsideCompartmentBounds =
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= compartment.boundingWidth ||
      cell.y >= compartment.boundingHeight

    if (isOutsideCompartmentBounds || !isOccupiedMaskCell(compartment.shapeMask, cell.x, cell.y)) {
      reasonSet.add(classifyPlacementBoundaryViolation(layout, compartment, cell, isOutsideCompartmentBounds))
      continue
    }

    if (occupiedKeys.has(`${cell.x}:${cell.y}`)) {
      reasonSet.add('overlap')
    }
  }

  return {
    isValid: reasonSet.size === 0,
    occupiedCells: cells,
    reasons: [...reasonSet],
  }
}

const classifyPlacementBoundaryViolation = (
  layout: ContainerLayoutDefinition | undefined,
  compartment: ContainerCompartmentDefinition,
  cell: CellCoordinate,
  isOutsideCompartmentBounds: boolean,
): PlacementValidationReason => {
  if (!layout) {
    return isOutsideCompartmentBounds ? 'out-of-bounds' : 'crosses-compartment-boundary'
  }

  const globalX = compartment.originX + cell.x
  const globalY = compartment.originY + cell.y
  if (globalX < 0 || globalY < 0 || globalX >= layout.boundingWidth || globalY >= layout.boundingHeight) {
    return 'out-of-bounds'
  }

  return 'crosses-compartment-boundary'
}
