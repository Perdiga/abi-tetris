import type { TrainingModeStorageUnitView } from '../../state/training-mode'

export interface StorageUnitTreeEntry {
  storageUnit: TrainingModeStorageUnitView
  depth: number
}

export const flattenStorageUnitTree = (
  rootStorageUnits: readonly TrainingModeStorageUnitView[],
  getStorageUnitById: (storageUnitId: string) => TrainingModeStorageUnitView | undefined,
): StorageUnitTreeEntry[] => {
  const visited = new Set<string>()
  const entries: StorageUnitTreeEntry[] = []

  const visit = (storageUnit: TrainingModeStorageUnitView, depth: number) => {
    if (visited.has(storageUnit.storageUnitId)) {
      return
    }

    visited.add(storageUnit.storageUnitId)
    entries.push({ storageUnit, depth })

    storageUnit.compartments.forEach((compartment) => {
      compartment.items.forEach((item) => {
        if (!item.containerStorageUnitId) {
          return
        }

        const childStorageUnit = getStorageUnitById(item.containerStorageUnitId)
        if (childStorageUnit) {
          visit(childStorageUnit, depth + 1)
        }
      })
    })
  }

  rootStorageUnits.forEach((storageUnit) => visit(storageUnit, 0))
  return entries
}
