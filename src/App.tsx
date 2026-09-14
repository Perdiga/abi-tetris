import './App.css'
import { useEffect, useMemo, useReducer } from 'react'

import { EquipmentScreen } from './components/equipment-screen/EquipmentScreen'
import {
  beginTrainingRun,
  createTrainingModeStore,
  selectTrainingResults,
  selectTrainingStatus,
  selectTrainingTimer,
  tickTrainingMode,
  trainingModeReducer,
} from './state/training-mode'

export interface AppProps {
  startSeed?: number
  tickIntervalMs?: number
}

function App({ startSeed, tickIntervalMs = 1000 }: AppProps) {
  const [state, dispatch] = useReducer(trainingModeReducer, createTrainingModeStore())
  const status = useMemo(() => selectTrainingStatus(state), [state])
  const timer = useMemo(() => selectTrainingTimer(state), [state])
  const results = useMemo(() => selectTrainingResults(state), [state])

  useEffect(() => {
    if (!status.isInteractive) {
      return
    }

    const intervalId = window.setInterval(() => {
      dispatch(tickTrainingMode(1))
    }, tickIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [status.isInteractive, tickIntervalMs])

  return (
    <main className="app-shell">
      {status.phase === 'RunActive' ? (
        <EquipmentScreen dispatch={dispatch} state={state} />
      ) : status.phase === 'ResultsScreen' && results ? (
        <section className="app-card" data-testid="results-screen">
          <p className="app-card__kicker">Run complete</p>
          <h1>{status.runEndReason === 'extract' ? 'Extraction successful' : 'Time cap reached'}</h1>
          <p className="app-card__copy">
            Final score ${results.finalScore.toLocaleString()} from ${results.grossScore.toLocaleString()} secured with a{' '}
            {results.medal} medal.
          </p>
          <dl className="app-results">
            <div>
              <dt>Elapsed</dt>
              <dd>{timer.formattedElapsed}</dd>
            </div>
            <div>
              <dt>Multiplier</dt>
              <dd>×{results.timePenaltyMultiplier.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Medal</dt>
              <dd>{results.medal}</dd>
            </div>
          </dl>
          <button className="app-card__action" onClick={() => dispatch(beginTrainingRun(startSeed))} type="button">
            Start another run
          </button>
        </section>
      ) : (
        <section className="app-card" data-testid="start-screen">
          <p className="app-card__kicker">ABI Trainer</p>
          <h1>Training mode</h1>
          <p className="app-card__copy">
            Start a run, let the engine spawn loot over time, pack value into secured storage, then
            extract early or ride the timer to results.
          </p>
          <button className="app-card__action" onClick={() => dispatch(beginTrainingRun(startSeed))} type="button">
            Start Run
          </button>
        </section>
      )}
    </main>
  )
}

export default App
