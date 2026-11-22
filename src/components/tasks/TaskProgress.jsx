import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import { Blossom } from '../Botanicals.jsx'

/**
 * Completion summary: percentage, counts and an accessible progress bar.
 * @param {{ progress: ReturnType<typeof import('../../lib/taskState.js').taskProgress> }} props
 */
export default function TaskProgress({ progress }) {
  const { total, completed, remaining, percent, allDone } = progress
  const summary = total === 0 ? 'עוד אין משימות ברשימה' : `${completed} מתוך ${total} הושלמו · נשארו ${remaining}`

  return (
    <Reveal as="section" className="card progress-card" aria-labelledby="progress-title">
      <h2 id="progress-title" className="sr-only">התקדמות</h2>
      <div className="progress-top">
        <span className="progress-percent" aria-hidden="true">{percent}%</span>
        <p className="progress-label" aria-live="polite">{summary}</p>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="התקדמות המשימות"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={total === 0 ? 'אין משימות' : `${percent}% — ${completed} מתוך ${total} משימות הושלמו`}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <ul className="progress-chips" aria-hidden="true">
        <li className="chip-done"><Icon name="check" strokeWidth={2.4} />{completed} הושלמו</li>
        <li>{remaining} נשארו</li>
      </ul>
      {allDone && (
        <p className="celebrate" role="status">
          <Blossom className="celebrate-blossom" />
          סיימתם את כל המשימות! איזה כיף 🤍
        </p>
      )}
    </Reveal>
  )
}
