import Icon from '../Icon.jsx'
import AnimatedMoney from '../AnimatedMoney.jsx'
import { calculateBudget } from '../../lib/budget.js'
import { STATUS, summaryView } from './summaryView.js'
import './MobileBalanceBar.css'

/**
 * Sticky balance shortcut for phones and tablets (hidden from 1024px, where the summary is sticky).
 * Mirrors the summary's state, including the "outdated" label.
 *
 * @param {{ parsed: import('../../lib/validation.js').ParsedBudget, lastValidValues: object | null }} props
 */
export default function MobileBalanceBar({ parsed, lastValidValues }) {
  const view = summaryView(parsed, lastValidValues)
  const result = view.values ? calculateBudget(view.values) : null
  const status = result ? STATUS[result.balanceStatus] : null
  const tone = result ? (view.stale ? 'stale' : result.balanceStatus) : 'even'

  return (
    <a className={`mobile-bar tone-${tone}`} href="#summary">
      <span className="mb-status">
        <span className="mb-icon" aria-hidden="true">
          <Icon name={result ? status.icon : view.kind === 'error' ? 'alert' : 'even'} strokeWidth={2.4} />
        </span>
        <span className="mb-text">
          {result ? (
            <>
              <span className="mb-label">
                {status.label}
                {view.stale && <span className="badge badge-warn">לא מעודכן</span>}
              </span>
              <AnimatedMoney className="mb-amount" value={Math.abs(result.balance)} />
            </>
          ) : (
            <>
              <span className="mb-label">{view.kind === 'error' ? 'יש לתקן שדות' : 'עוד אין חישוב'}</span>
              {view.kind === 'empty' && <span className="mb-amount mb-hint">הזינו פרטים</span>}
            </>
          )}
        </span>
      </span>
      <span className="mb-cta">למאזן<Icon name="arrowDown" strokeWidth={2} /></span>
    </a>
  )
}
