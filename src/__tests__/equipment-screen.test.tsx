import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { CompartmentGrid } from '../components/grids/CompartmentGrid'
import type { GridLayout } from '../components/grids/types'

const testLayout: GridLayout = {
  id: 'test-layout', label: 'Test Layout', width: 5, height: 3,
  regions: [
    { id: 'left', label: 'Left', originX: 0, originY: 0, shapeMask: ['110', '111'], accent: '#38bdf8' },
    { id: 'right', label: 'Right', originX: 3, originY: 0, shapeMask: ['11', '10'], accent: '#f59e0b' },
  ],
}

afterEach(() => { cleanup(); vi.useRealTimers() })

const startRun = () => {
  fireEvent.click(screen.getByRole('button', { name: /start run/i }))
  expect(screen.queryByTestId('start-screen')).not.toBeInTheDocument()
}

const advanceToFirstLootDrop = () => act(() => vi.advanceTimersByTime(1000))

describe('equipment screen shell', () => {
  it('renders a compartment-aware grid with the expected cell count', () => {
    render(<CompartmentGrid getPlacementValidation={() => null} items={[]} layout={testLayout} onItemSelect={() => {}} onPlaceItem={() => {}} selectedItem={null} selectedItemId={null} />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(8)
  })

  it('starts with the player starter loadout and exposes the run HUD', () => {
    vi.useFakeTimers(); render(<App startSeed={7} tickIntervalMs={1000} />); startRun()
    expect(screen.getByTestId('secured-value')).toHaveTextContent('$0')
    expect(screen.getByTestId('players-remaining')).toHaveTextContent('6 / 6 players remaining')
    expect(screen.getByTestId('ground-loot-grid')).toBeInTheDocument()
  })

  it('adds ground loot when the first bot dies', () => {
    vi.useFakeTimers(); render(<App startSeed={7} tickIntervalMs={1000} />); startRun(); advanceToFirstLootDrop()
    expect(screen.getByTestId('players-remaining')).toHaveTextContent('5 / 6 players remaining')
    expect(screen.getByTestId('ground-loot-grid')).toBeInTheDocument()
    expect(screen.getByTestId('item-bot-1-backpack')).toBeInTheDocument()
  })

  it('updates the elapsed timer while the run is active', () => {
    vi.useFakeTimers(); render(<App startSeed={7} tickIntervalMs={1000} />); startRun()
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('09:57')).toBeInTheDocument()
  })

  it('keeps selection feedback when a ground-loot item is selected', () => {
    vi.useFakeTimers(); render(<App startSeed={7} tickIntervalMs={1000} />); startRun(); advanceToFirstLootDrop()
    const backpack = screen.getByTestId('item-bot-1-backpack'); fireEvent.click(backpack)
    expect(backpack).toHaveClass('ground-loot-panel__item-card--selected')
    expect(screen.getByTestId('slot-target-backpack')).toHaveClass('equipment-screen__slot--valid')
  })

  it('equips generated loot in a valid destination', () => {
    vi.useFakeTimers(); render(<App startSeed={7} tickIntervalMs={1000} />); startRun(); advanceToFirstLootDrop()
    fireEvent.click(screen.getByTestId('item-bot-1-backpack'))
    fireEvent.click(screen.getByTestId('slot-target-backpack'))
    expect(screen.queryByTestId('item-bot-1-backpack')).not.toBeInTheDocument()
    expect(screen.getByTestId('storage-source-bot-1-backpack')).toBeInTheDocument()
  })

  it('transitions to results when extracting', () => {
    vi.useFakeTimers(); render(<App startSeed={7} tickIntervalMs={1000} />); startRun(); advanceToFirstLootDrop()
    fireEvent.click(screen.getByRole('button', { name: /extract now/i }))
    expect(screen.getByTestId('results-screen')).toBeInTheDocument()
    expect(screen.getByText(/Extraction successful/i)).toBeInTheDocument()
  })
})
