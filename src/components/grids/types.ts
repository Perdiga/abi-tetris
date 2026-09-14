import type { EquipmentSlotId, Rotation } from '../../data'
import type {
  TrainingModeCompartmentView,
  TrainingModeItemView,
  TrainingModeStorageUnitView,
} from '../../state/training-mode'

export type GridMask = readonly string[]
export type SupportedRotation = Extract<Rotation, 0 | 90>
export type InventoryItemRecord = TrainingModeItemView

export interface GridRegion {
  id: string
  label: string
  originX: number
  originY: number
  shapeMask: GridMask
  accent?: string
}

export interface GridLayout {
  id: string
  label: string
  width: number
  height: number
  testId?: string
  sourceItemInstanceId?: string
  regions: readonly GridRegion[]
}

export interface CellTarget {
  kind: 'container'
  storageUnitId: string
  compartmentId: string
  x: number
  y: number
}

export interface SlotTarget {
  kind: 'equipment-slot'
  slotId: EquipmentSlotId
}

export type PlacementTarget = CellTarget | SlotTarget

const REGION_ACCENTS = ['#38bdf8', '#818cf8', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6'] as const

const toGridRegion = (
  compartment: TrainingModeCompartmentView,
  index: number,
): GridRegion => ({
  id: compartment.compartmentId,
  label: compartment.label,
  originX: compartment.originX,
  originY: compartment.originY,
  shapeMask: compartment.shapeMask,
  accent: REGION_ACCENTS[index % REGION_ACCENTS.length],
})

export const toGridLayout = (storageUnit: TrainingModeStorageUnitView): GridLayout => ({
  id: storageUnit.storageUnitId,
  label: storageUnit.label,
  width: storageUnit.boundingWidth,
  height: storageUnit.boundingHeight,
  testId: storageUnit.sourceItem?.equippedSlotId ?? storageUnit.storageUnitId,
  sourceItemInstanceId: storageUnit.sourceItemInstanceId,
  regions: storageUnit.compartments.map((compartment, index) => toGridRegion(compartment, index)),
})
