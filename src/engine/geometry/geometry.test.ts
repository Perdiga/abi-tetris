import { describe, expect, it } from 'vitest'
import { createCatalogIndex } from '../../data'
import { rotateMask, validatePlacement } from './index'

const catalog = createCatalogIndex()

describe('geometry placement engine', () => {
  it('accepts a valid fit inside a compartment mask', () => {
    const compartment = catalog.compartmentsById['bp-example-top']
    const result = validatePlacement({
      itemMask: ['11', '11'],
      rotation: 0,
      compartment,
      position: { x: 0, y: 0 },
    })

    expect(result.isValid).toBe(true)
    expect(result.reasons).toEqual([])
  })

  it('rejects overlap with occupied cells', () => {
    const compartment = catalog.compartmentsById['bp-example-top']
    const result = validatePlacement({
      itemMask: ['11'],
      rotation: 0,
      compartment,
      position: { x: 0, y: 0 },
      occupiedCells: [{ x: 1, y: 0 }],
    })

    expect(result.isValid).toBe(false)
    expect(result.reasons).toContain('overlap')
  })

  it('rejects an item that is too large for every split-backpack compartment', () => {
    const oversizedMask = ['1111', '1111', '1111', '1111']
    const compartments = [
      'bp-example-top',
      'bp-example-left',
      'bp-example-center',
      'bp-example-right',
    ] as const

    for (const compartmentId of compartments) {
      const result = validatePlacement({
        itemMask: oversizedMask,
        rotation: 0,
        compartment: catalog.compartmentsById[compartmentId],
        position: { x: 0, y: 0 },
      })

      expect(result.isValid).toBe(false)
      expect(result.reasons).toContain('out-of-bounds')
      expect(result.occupiedCells).toHaveLength(16)
    }
  })

  it('supports rotation for non-rectangular masks', () => {
    expect(rotateMask(['11111', '00100'], 90)).toEqual(['01', '01', '11', '01', '01'])
  })

  it('rejects 180° and 270° rotations in v1-facing validation', () => {
    const compartment = catalog.compartmentsById['bp-example-top']
    const result = validatePlacement({
      itemMask: ['11'],
      rotation: 180,
      compartment,
      position: { x: 0, y: 0 },
    })

    expect(result.isValid).toBe(false)
    expect(result.reasons).toEqual(['unsupported-rotation'])
  })

  it('enforces compartment boundaries even when neighboring compartments are adjacent', () => {
    const compartment = catalog.compartmentsById['bp-example-left']
    const result = validatePlacement({
      itemMask: ['11'],
      rotation: 0,
      compartment,
      position: { x: 0, y: 0 },
    })

    expect(result.isValid).toBe(false)
    expect(result.reasons).toContain('out-of-bounds')
  })

  it('rejects split-backpack placements that cross top/lower or side/main compartment boundaries', () => {
    const layout = catalog.layoutsById['layout-backpack-split']
    const crossingCases = [
      {
        compartmentId: 'bp-example-top',
        itemMask: ['111', '111', '111', '111'],
        description: 'top into center',
      },
      {
        compartmentId: 'bp-example-left',
        itemMask: ['11', '11', '11'],
        description: 'left pouch into center',
      },
      {
        compartmentId: 'bp-example-center',
        itemMask: ['1111', '1111', '1111'],
        description: 'center into right pouch',
      },
    ] as const

    for (const testCase of crossingCases) {
      const result = validatePlacement({
        itemMask: testCase.itemMask,
        rotation: 0,
        compartment: catalog.compartmentsById[testCase.compartmentId],
        position: { x: 0, y: 0 },
        layout,
      })

      expect(result.isValid, testCase.description).toBe(false)
      expect(result.reasons, testCase.description).toEqual(['crosses-compartment-boundary'])
    }
  })

  it('ignores item mask holes but still rejects any occupied cell that crosses an irregular boundary', () => {
    const irregularCompartment = {
      id: 'irregular',
      layoutId: 'layout-irregular',
      label: 'irregular',
      originX: 0,
      originY: 0,
      shapeMask: ['10', '11'],
      boundingWidth: 2,
      boundingHeight: 2,
      sortOrder: 1,
    }

    const holeAlignedToInvalidCell = validatePlacement({
      itemMask: ['10', '11'],
      rotation: 0,
      compartment: irregularCompartment,
      position: { x: 0, y: 0 },
    })

    expect(holeAlignedToInvalidCell.isValid).toBe(true)
    expect(holeAlignedToInvalidCell.reasons).toEqual([])

    const occupiedCellCrossingBoundary = validatePlacement({
      itemMask: ['11', '01'],
      rotation: 0,
      compartment: irregularCompartment,
      position: { x: 0, y: 0 },
    })

    expect(occupiedCellCrossingBoundary.isValid).toBe(false)
    expect(occupiedCellCrossingBoundary.reasons).toContain('crosses-compartment-boundary')
  })
})
