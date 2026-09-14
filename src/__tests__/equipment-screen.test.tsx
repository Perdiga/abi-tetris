import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { CompartmentGrid } from '../components/grids/CompartmentGrid'
import type { GridLayout } from '../components/grids/types'

const testLayout: GridLayout = {
  id: 'test-layout',
  label: 'Test Layout',
  width: 5,
  height: 3,
  regions: [
    {
      id: 'left',
      label: 'Left',
      originX: 0,
      originY: 0,
      shapeMask: ['110', '111'],
      accent: '#38bdf8',
    },
    {
      id: 'right',
      label: 'Right',
      originX: 3,
      originY: 0,
      shapeMask: ['11', '10'],
      accent: '#f59e0b',
    },
  ],
}

function createDragDataTransfer() {
  const store = new Map<string, string>()

  return {
    effectAllowed: 'all',
    setData: (format: string, value: string) => {
      store.set(format, value)
    },
    getData: (format: string) => store.get(format) ?? '',
    clearData: (format?: string) => {
      if (format) {
        store.delete(format)
        return
      }

      store.clear()
    },
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const startRun = () => {
  fireEvent.click(screen.getByRole('button', { name: /start run/i }))
  expect(screen.queryByTestId('start-screen')).not.toBeInTheDocument()
}

const advanceToFirstLootDrop = () => {
  act(() => {
    vi.advanceTimersByTime(1000)
  })
}

const equipFirstBotBackpack = () => {
  const backpackCard = screen.getByTestId('item-bot-1-backpack')
  if (!backpackCard.classList.contains('ground-loot-panel__item-card--selected')) {
    fireEvent.click(backpackCard)
  }
  fireEvent.click(screen.getByTestId('slot-target-backpack'))
}

describe('equipment screen shell', () => {
  it('renders a compartment-aware grid with the expected cell count', () => {
    render(
      <CompartmentGrid
        getPlacementValidation={() => null}
        items={[]}
        layout={testLayout}
        onItemSelect={() => {}}
        onPlaceItem={() => {}}
        selectedItem={null}
        selectedItemId={null}
      />,
    )

    expect(screen.getAllByRole('gridcell')).toHaveLength(8)
  })

  it('starts a run empty and lets the player equip looted storage before stashing more items', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    expect(screen.getByTestId('secured-value')).toHaveTextContent('$0')
    expect(screen.queryByTestId('slot-item-backpack')).not.toBeInTheDocument()

    advanceToFirstLootDrop()
    equipFirstBotBackpack()

    fireEvent.click(screen.getByTestId('item-bot-1-tactical-vest-item-0'))
    fireEvent.click(screen.getByTestId('cell-backpack-bp-example-top-2-2'))

    const backpackGrid = screen.getByTestId('grid-backpack')
    expect(within(backpackGrid).getByTestId('item-bot-1-tactical-vest-item-0')).toBeInTheDocument()
    expect(screen.getByText(/Placeholder Ration Pack moved into bp-example-top/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('transitions to the results screen after extract now', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    fireEvent.click(screen.getByRole('button', { name: /extract now/i }))
    expect(screen.getByTestId('results-screen')).toBeInTheDocument()
    expect(screen.getByText(/Extraction successful/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('renders and updates the players remaining readout as bots die', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    expect(screen.getByTestId('players-remaining')).toHaveTextContent('6 / 6 players remaining')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId('players-remaining')).toHaveTextContent('5 / 6 players remaining')

    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(screen.getByTestId('players-remaining')).toHaveTextContent('4 / 6 players remaining')

    vi.useRealTimers()
  })

  it('equips looted gear from the ground and carries its secured value into extraction results', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()

    equipFirstBotBackpack()
    fireEvent.click(screen.getByTestId('item-bot-1-helmet'))
    fireEvent.click(screen.getByRole('button', { name: /^Helmet/i }))
    fireEvent.click(screen.getByTestId('item-bot-1-pistol'))
    fireEvent.click(screen.getByRole('button', { name: /^Pistol/i }))

    const securedValueText = screen.getByTestId('secured-value').textContent ?? '$0'

    fireEvent.click(screen.getByRole('button', { name: /extract now/i }))

    expect(screen.getByTestId('results-screen')).toBeInTheDocument()
    expect(screen.getByText(/Extraction successful/i)).toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes(`Final score ${securedValueText} from ${securedValueText} secured`)),
    ).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('supports dragging a ground-loot item directly into a valid backpack cell', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()

    const dragDataTransfer = createDragDataTransfer()
    const lootedBackpackCard = screen.getByTestId('item-bot-1-backpack')
    const targetSlot = screen.getByTestId('slot-target-backpack')

    fireEvent.dragStart(lootedBackpackCard, { dataTransfer: dragDataTransfer })
    fireEvent.dragOver(targetSlot, { dataTransfer: dragDataTransfer })
    fireEvent.drop(targetSlot, { dataTransfer: dragDataTransfer })

    const backpackGrid = screen.getByTestId('grid-backpack')
    expect(screen.getByTestId('slot-item-backpack')).toBeInTheDocument()
    expect(within(backpackGrid).getByTestId('item-bot-1-backpack-item-1')).toBeInTheDocument()
    expect(screen.getByText(/Placeholder Split Backpack equipped in backpack/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('drops a selected equipped item into the ground stash from the selection card button', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()
    equipFirstBotBackpack()

    fireEvent.click(screen.getByTestId('slot-item-backpack'))
    fireEvent.click(screen.getByTestId('drop-to-ground-button'))

    const groundLootGrid = screen.getByTestId('ground-loot-grid')
    expect(within(groundLootGrid).getByTestId('item-bot-1-backpack')).toBeInTheDocument()
    expect(screen.queryByTestId('slot-item-backpack')).not.toBeInTheDocument()
    expect(screen.getByText(/Placeholder Split Backpack dropped to the ground\./i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('supports dragging a selected player-storage item back into the ground stash', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()
    equipFirstBotBackpack()

    const backpackGrid = screen.getByTestId('grid-backpack')
    const groundLootGrid = screen.getByTestId('ground-loot-grid')
    const storedMedkit = within(backpackGrid).getByTestId('item-bot-1-backpack-item-1')
    const dragDataTransfer = createDragDataTransfer()

    fireEvent.dragStart(storedMedkit, { dataTransfer: dragDataTransfer })
    fireEvent.dragOver(groundLootGrid, { dataTransfer: dragDataTransfer })
    fireEvent.drop(groundLootGrid, { dataTransfer: dragDataTransfer })

    expect(within(groundLootGrid).getByTestId('item-bot-1-backpack-item-1')).toBeInTheDocument()
    expect(within(backpackGrid).queryByTestId('item-bot-1-backpack-item-1')).not.toBeInTheDocument()
    expect(screen.getByText(/Placeholder Field Medkit dropped to the ground\./i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('accumulates multiple dropped player items in the same ground-loot pile', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()
    equipFirstBotBackpack()
    const backpackGrid = screen.getByTestId('grid-backpack')

    fireEvent.click(within(backpackGrid).getByTestId('item-bot-1-backpack-item-1'))
    fireEvent.click(screen.getByTestId('drop-to-ground-button'))

    fireEvent.click(within(backpackGrid).getByTestId('item-bot-1-backpack-item-0'))
    fireEvent.click(screen.getByTestId('drop-to-ground-button'))

    const groundLootGrid = screen.getByTestId('ground-loot-grid')
    expect(within(groundLootGrid).getByTestId('item-bot-1-backpack-item-1')).toBeInTheDocument()
    expect(within(groundLootGrid).getByTestId('item-bot-1-backpack-item-0')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('shows rule feedback when trying to collapse a non-empty equipped backpack', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()
    equipFirstBotBackpack()

    fireEvent.click(screen.getByTestId('slot-item-backpack'))
    fireEvent.click(screen.getByRole('button', { name: /^Collapsed$/i }))

    expect(
      screen.getByText(/Collapsed or rolled storage states require the container to be completely empty in v1\./i),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('results-screen')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('rotates the selected item when pressing the R key', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()

    fireEvent.click(screen.getByTestId('item-bot-1-backpack-item-1'))
    expect(screen.getByText(/Selected Placeholder Field Medkit/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'r' })

    expect(screen.getByText(/Placeholder Field Medkit rotated to 90°\./i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'R' })

    expect(screen.getByText(/Placeholder Field Medkit rotated to 0°\./i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('renders the restyled nameplates and corner chips for equipped, stored, and looted items', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()

    const lootedBackpackCard = screen.getByTestId('item-bot-1-backpack')
    expect(lootedBackpackCard.querySelector('.ground-loot-panel__item-nameplate')).toHaveTextContent(
      'Placeholder Split Backpack',
    )
    expect(lootedBackpackCard.querySelector('.ground-loot-panel__item-meta')).toHaveTextContent('OPEN')
    expect(lootedBackpackCard.querySelector('.ground-loot-panel__item-count')).toHaveTextContent('3×3')

    fireEvent.click(screen.getByTestId('item-bot-1-pistol'))
    fireEvent.click(screen.getByRole('button', { name: /^Pistol/i }))
    equipFirstBotBackpack()

    const equippedPistol = screen.getByTestId('slot-item-pistol')
    expect(equippedPistol.querySelector('.equipment-screen__slot-item-nameplate')).toHaveTextContent(
      'Placeholder Service Pistol',
    )
    expect(equippedPistol.querySelector('.equipment-screen__slot-item-chip--top-right')).toHaveTextContent('♥100')
    expect(equippedPistol.querySelector('.equipment-screen__slot-item-chip--badge')).toHaveTextContent('3')
    expect(equippedPistol.querySelector('.equipment-screen__slot-item-chip--bottom-left')).toHaveTextContent(
      'SIDEARM',
    )
    expect(equippedPistol.querySelector('.equipment-screen__slot-item-chip--bottom-right')).toHaveTextContent('100')

    const storedMedkit = within(screen.getByTestId('grid-backpack')).getByTestId('item-bot-1-backpack-item-1')
    expect(storedMedkit.querySelector('.compartment-grid__item-nameplate')).toHaveTextContent(
      'Placeholder Field Medkit',
    )
    expect(storedMedkit.querySelector('.compartment-grid__item-chip--top-right')).toHaveTextContent('♥400')
    expect(storedMedkit.querySelector('.compartment-grid__item-chip--bottom-left')).toHaveTextContent('MED')
    expect(storedMedkit.querySelector('.compartment-grid__item-chip--bottom-right')).toHaveTextContent('400')
  })

  it('applies category tint variables from itemPresentation across equipped, stored, and loot items', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()

    const lootedBackpackCard = screen.getByTestId('item-bot-1-backpack')
    expect(lootedBackpackCard.style.getPropertyValue('--item-tint')).toBe('#344734')

    equipFirstBotBackpack()

    expect(screen.getByTestId('slot-item-backpack').style.getPropertyValue('--item-tint')).toBe('#344734')
    expect(
      within(screen.getByTestId('grid-backpack')).getByTestId('item-bot-1-backpack-item-1').style.getPropertyValue(
        '--item-tint',
      ),
    ).toBe('#715924')
  })

  it('keeps the selected-item highlight classes and key test ids after the visual restyle', () => {
    vi.useFakeTimers()
    render(<App startSeed={7} tickIntervalMs={1000} />)

    startRun()
    advanceToFirstLootDrop()

    const lootedBackpackCard = screen.getByTestId('item-bot-1-backpack')
    fireEvent.click(lootedBackpackCard)
    expect(lootedBackpackCard).toHaveClass('ground-loot-panel__item-card--selected')
    expect(screen.getByTestId('ground-loot-grid')).toBeInTheDocument()

    equipFirstBotBackpack()
    fireEvent.click(screen.getByTestId('item-bot-1-pistol'))
    fireEvent.click(screen.getByRole('button', { name: /^Pistol/i }))

    const equippedPistol = screen.getByTestId('slot-item-pistol')
    fireEvent.click(equippedPistol)
    expect(equippedPistol).toHaveClass('equipment-screen__slot-item--selected')
    expect(screen.getByTestId('grid-backpack')).toBeInTheDocument()
    expect(screen.getByTestId('slot-item-backpack')).toHaveClass('equipment-screen__storage-source')
    expect(screen.getByTestId('cell-backpack-bp-example-top-0-0')).toBeInTheDocument()

    const storedMedkit = within(screen.getByTestId('grid-backpack')).getByTestId('item-bot-1-backpack-item-1')
    fireEvent.click(storedMedkit)
    expect(storedMedkit).toHaveClass('compartment-grid__item--selected')
    expect(screen.getByTestId('secured-value')).toBeInTheDocument()
  })
})
