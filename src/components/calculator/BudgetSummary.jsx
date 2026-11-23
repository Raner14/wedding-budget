import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import AnimatedMoney from '../AnimatedMoney.jsx'
import { Blossom, Rings } from '../Botanicals.jsx'
import { calculateBudget } from '../../lib/budget.js'
import { formatMoney, formatNumber } from '../../lib/format.js'
import { STATUS, summaryView } from './summaryView.js'
import './BudgetSummary.css'

const ANNOUNCE_DELAY_MS = 700
const fieldsWord = (n) => (n === 1 ? 'שדה אחד' : `${n} שדות`)

/** Moves focus to the first invalid field, opening a collapsed section if needed. */
function focusFirstInvalid() {
  const first = document.querySelector('main [aria-invalid="true"]')
  if (!first) return
  const details = first.closest('details')
  if (details) details.open = true
  first.focus()
  first.scrollIntoView?.({ block: 'center' })
}

/** Screen-reader announcement, debounced so typing does not flood the user. */
function useDebouncedAnnouncement(text) {
  const [announced, setAnnounced] = useState(text)
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(text), ANNOUNCE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])
  return announced
}

function balanceNote(result) {
  if (result.attendingGuests === 0) {
    if (result.familyGiftIncome > 0) return 'אין אורחים מגיעים, כך שההכנסה היא ממתנות המשפחה בלבד.'
    return result.totalCost > 0
      ? 'אין אורחים מגיעים, ולכן אין הכנסה ממתנות. ההפסד הוא סך כל ההוצאות.'
      : 'אין אורחים מגיעים ואין הוצאות.'
  }
  if (result.balanceStatus === 'profit') return 'המתנות צפויות לכסות את כל ההוצאות, ועוד יישאר לכם.'
  if (result.balanceStatus === 'loss') return 'ההוצאות צפויות לעבור את המתנות. כדאי לבחון תרחישים למטה.'
  return 'המתנות צפויות לכסות בדיוק את ההוצאות.'
}

function GiftComparison({ result, averageGift }) {
  if (result.breakEvenGift === null) {
    return <p className="metric-cmp">אין אורחים מגיעים, ולכן אי אפשר לחשב עלות לאורח.</p>
  }
  const diff = averageGift - result.breakEvenGift
  if (diff > 0) {
    return <p className="metric-cmp cmp-pos"><Icon name="up" strokeWidth={2.4} /><span>המתנה שהזנתם גבוהה ב-<bdi>{formatMoney(diff)}</bdi> מנקודת האיזון</span></p>
  }
  if (diff < 0) {
    return <p className="metric-cmp cmp-neg"><Icon name="down" strokeWidth={2.4} /><span>חסרים <bdi>{formatMoney(-diff)}</bdi> לאורח כדי להגיע לאיזון</span></p>
  }
  return <p className="metric-cmp"><Icon name="even" strokeWidth={2.4} /><span>המתנה שהזנתם בדיוק בנקודת האיזון</span></p>
}

function MealBreakEven({ breakEven, mealPrice }) {
  if (breakEven.status === 'ok') {
    return (
      <>
        <AnimatedMoney className="metric-value" value={breakEven.value} />
        <p className="metric-sub">
          {mealPrice <= breakEven.value
            ? `המחיר הנוכחי (${formatMoney(mealPrice)}) בטווח.`
            : `המחיר הנוכחי (${formatMoney(mealPrice)}) גבוה ממנו.`}
        </p>
      </>
    )
  }
  if (breakEven.status === 'impossible') {
    return (
      <>
        <span className="metric-value is-text">אין מחיר איזון</span>
        <p className="metric-sub">גם אם המנה תהיה בחינם, ההוצאות האחרות גבוהות מהכנסות המתנות ב-{formatMoney(breakEven.shortfall)}.</p>
      </>
    )
  }
  return (
    <>
      <span className="metric-value">—</span>
      <p className="metric-sub">אין מנות לחיוב.</p>
    </>
  )
}

/**
 * The budget summary card. Shows current results, or the last valid results
 * clearly marked as outdated while a field is invalid — never stale numbers unlabeled.
 *
 * @param {{ parsed: import('../../lib/validation.js').ParsedBudget, lastValidValues: object | null }} props
 */
export default function BudgetSummary({ parsed, lastValidValues }) {
  const view = summaryView(parsed, lastValidValues)
  const result = view.values ? calculateBudget(view.values) : null
  const tone = result ? (view.stale ? 'stale' : result.balanceStatus) : null
  const status = result ? STATUS[result.balanceStatus] : null

  // Gentle "pop" when the balance changes between profit / loss / even.
  const balanceRef = useRef(null)
  const previousTone = useRef(tone)
  useEffect(() => {
    const el = balanceRef.current
    if (el && previousTone.current && tone && previousTone.current !== tone) {
      el.classList.remove('pop')
      void el.offsetWidth // restart the CSS animation
      el.classList.add('pop')
    }
    previousTone.current = tone
  }, [tone])

  const announcement = useDebouncedAnnouncement(
    view.kind === 'error' ? 'יש לתקן את השדות המסומנים'
      : result ? `${status.label} ${formatNumber(Math.abs(result.balance))} שקלים${view.stale ? ', לא מעודכן' : ''}` : '',
  )

  const maxBar = result ? Math.max(result.totalCost, result.totalIncome) : 0
  const barWidth = (value) => (maxBar ? `${(value / maxBar) * 100}%` : '0%')

  return (
    <aside className="col-summary" id="summary" aria-labelledby="summary-title">
      <Reveal className="card summary-card">
        <Blossom className="blossom-deco" />
        <div className="summary-head">
          <h3 id="summary-title" className="card-title">המאזן שלכם</h3>
          <span className="live-dot">מתעדכן בזמן אמת</span>
        </div>
        <p className="sr-only" aria-live="polite">{announcement}</p>

        {parsed.errorCount > 0 && (
          <div className="alert alert-warn alert-first">
            <Icon name="warning" strokeWidth={2} />
            <div>
              <strong>{view.stale ? 'התוצאות לא מעודכנות' : 'יש לתקן את השדות המסומנים'}</strong>
              <p>
                {view.stale
                  ? `מוצג החישוב האחרון התקין. יש לתקן ${fieldsWord(parsed.errorCount)} כדי לעדכן אותו.`
                  : `כדי לראות תוצאה יש לתקן ${fieldsWord(parsed.errorCount)}.`}
              </p>
              <button type="button" className="link-btn" onClick={focusFirstInvalid}>מעבר לשדה הראשון לתיקון</button>
            </div>
          </div>
        )}

        {view.kind === 'empty' && (
          <div className="summary-empty">
            <div className="empty-art" aria-hidden="true"><Rings /></div>
            <h4>הסיפור שלכם מתחיל כאן</h4>
            <p>מלאו כמה פרטים, והמאזן יופיע כאן.</p>
            <ol className="empty-steps">
              <li>כמה אורחים מזמינים</li>
              <li>מחיר למנה</li>
              <li>מתנה ממוצעת לאורח</li>
            </ol>
          </div>
        )}

        {result && (
          <div className={view.stale ? 'summary-content is-stale' : 'summary-content'}>
            <div className={`balance tone-${tone}`} ref={balanceRef} data-testid="balance">
              <div className="balance-top">
                <span className="status-icon" aria-hidden="true"><Icon name={status.icon} strokeWidth={2.4} /></span>
                <span className="balance-label">{status.label}</span>
                {view.stale && <span className="badge badge-warn">לא מעודכן</span>}
              </div>
              <AnimatedMoney className="balance-amount" value={Math.abs(result.balance)} />
              <p className="balance-note">{balanceNote(result)}</p>
            </div>

            <div className="compare">
              <div>
                <div className="cmp-top"><span>סך ההוצאות</span><AnimatedMoney value={result.totalCost} /></div>
                <div className="cmp-track" aria-hidden="true"><span className="cmp-bar bar-exp" style={{ width: barWidth(result.totalCost) }} /></div>
              </div>
              <div>
                <div className="cmp-top">
                  <span>
                    מתנות צפויות
                    <small>{formatNumber(result.baseGuests)} אורחים × {formatMoney(view.values.averageGift)}</small>
                    {result.reserveGuests > 0 && (
                      <small>+ {formatNumber(result.reserveGuests)} אורחי רזרבה × {formatMoney(result.reserveGift)}</small>
                    )}
                    {result.familyGiftIncome > 0 && <small>+ מתנות מהמשפחה {formatMoney(result.familyGiftIncome)}</small>}
                  </span>
                  <AnimatedMoney value={result.totalIncome} />
                </div>
                <div className="cmp-track" aria-hidden="true"><span className="cmp-bar bar-gift" style={{ width: barWidth(result.totalIncome) }} /></div>
              </div>
            </div>

            <p className="mini-title">פירוט ההוצאות</p>
            <dl className="breakdown">
              <div className="bd-row">
                <dt>
                  אולם ומנות
                  <span className="bd-sub">
                    {formatNumber(result.mainMeals)} מנות × {formatMoney(view.values.mealPrice)}
                    {result.reserveMealsBilled > 0 &&
                      ` + ${formatNumber(result.reserveMealsBilled)} מנות רזרבה × ${formatMoney(result.reserveMealPrice)}`}
                  </span>
                </dt>
                <dd><AnimatedMoney value={result.venueCost} /></dd>
              </div>
              <div className="bd-row">
                <dt>הוצאות נוספות</dt>
                <dd><AnimatedMoney value={result.additionalCost} /></dd>
              </div>
            </dl>

            {result.unusedMeals > 0 && (
              <div className="alert alert-info">
                <Icon name="info" strokeWidth={2} />
                <p>בגלל מינימום המנות תשלמו על {formatNumber(result.unusedMeals)} מנות שלא ינוצלו ({formatMoney(result.unusedMeals * view.values.mealPrice)}).</p>
              </div>
            )}

            <div className="metrics">
              <div className="metric">
                <div className="metric-head"><Icon name="gift" /><p className="metric-label">מתנה ממוצעת לאיזון</p></div>
                {result.breakEvenGift === null ? <span className="metric-value">—</span> : <AnimatedMoney className="metric-value" value={result.breakEvenGift} />}
                <p className="metric-sub">
                  {result.costPerAttendee === null
                    ? 'המתנה הממוצעת לאורח שנדרשת כדי לא להפסיד'
                    : `עלות לאורח מגיע: ${formatMoney(result.costPerAttendee)}${result.familyGiftIncome > 0 ? ' (לפני מתנות המשפחה)' : ''}`}
                </p>
                <GiftComparison result={result} averageGift={view.values.averageGift} />
              </div>
              <div className="metric">
                <div className="metric-head"><Icon name="dish" /><p className="metric-label">מחיר מנה מקסימלי לאיזון</p></div>
                <MealBreakEven breakEven={result.breakEvenMealPrice} mealPrice={view.values.mealPrice} />
              </div>
            </div>
            <p className="disclaimer">הערכה בלבד · כל המחירים כוללים מע״מ</p>
          </div>
        )}
      </Reveal>
    </aside>
  )
}
