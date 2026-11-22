import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import AnimatedMoney from '../AnimatedMoney.jsx'
import { Rings } from '../Botanicals.jsx'
import { prefersReducedMotion } from '../motion.js'
import { createExpense, MAX_EXPENSES } from '../../lib/budgetState.js'
import { expenseIconKey } from '../../lib/expenseIcon.js'
import { formatWholeInput, MAX_EXPENSE_NAME_LENGTH } from '../../lib/validation.js'
import './ExpensesList.css'

const LEAVE_ANIMATION_MS = 220
const displayName = (name) => name.trim() || 'ללא שם'

/**
 * Step 2 — the automatic venue row plus the editable list of additional expenses.
 *
 * @param {{
 *   expenses: {id: string, name: string, amount: string}[],
 *   errors: Record<string, {name?: string, amount?: string}>,
 *   venueCost: number | null,
 *   expensesTotal: number | null,
 *   highlightId: string | null,
 *   onAdd: (expense: object) => void,
 *   onUpdate: (id: string, patch: {name?: string, amount?: string}) => void,
 *   onRemove: (expense: object, index: number) => void,
 * }} props
 */
export default function ExpensesList({ expenses, errors, venueCost, expensesTotal, highlightId, onAdd, onUpdate, onRemove }) {
  const listRef = useRef(null)
  const addRef = useRef(null)
  const [leavingId, setLeavingId] = useState(null)
  const canAdd = expenses.length < MAX_EXPENSES

  function handleAdd() {
    const expense = createExpense()
    flushSync(() => onAdd(expense))
    document.getElementById(`expense-name-${expense.id}`)?.focus()
  }

  function removeNow(expense, index) {
    // Commit synchronously so focus can move to an element that exists in the new DOM.
    flushSync(() => {
      setLeavingId(null)
      onRemove(expense, index)
    })
    const deleteButtons = listRef.current?.querySelectorAll('[data-role="delete"]') ?? []
    ;(deleteButtons[index] ?? addRef.current)?.focus()
  }

  function handleDelete(expense, index) {
    if (prefersReducedMotion()) return removeNow(expense, index)
    setLeavingId(expense.id)
    setTimeout(() => removeNow(expense, index), LEAVE_ANIMATION_MS)
  }

  return (
    <Reveal as="section" className="card expenses-card" aria-labelledby="expenses-title">
      <div className="card-head">
        <span className="card-icon" aria-hidden="true"><Icon name="star" /></span>
        <div>
          <p className="card-kicker">שלב 2</p>
          <h3 id="expenses-title" className="card-title">כל מה שעושה את היום</h3>
          <p className="card-desc">ערכו, הוסיפו או מחקו. הוצאה לא רלוונטית? השאירו 0.</p>
        </div>
      </div>

      <div className="venue-row">
        <span className="exp-icon" aria-hidden="true"><Rings /></span>
        <div className="venue-meta">
          <span className="venue-name">אולם ומנות</span>
          <span className="badge">מחושב אוטומטית</span>
          <a className="link-sm" href="#field-mealPrice">שינוי בפרטי האירוע</a>
        </div>
        <AnimatedMoney className="venue-amount" value={venueCost} />
      </div>

      {expenses.length > 0 ? (
        <ul className="exp-list" ref={listRef} aria-label="הוצאות נוספות">
          {expenses.map((expense, index) => {
            const error = errors[expense.id] ?? {}
            const label = displayName(expense.name)
            const nameErrorId = `expense-name-${expense.id}-error`
            const amountErrorId = `expense-amount-${expense.id}-error`
            const rowClass = ['exp-row', expense.id === highlightId && 'is-new', expense.id === leavingId && 'is-leaving']
              .filter(Boolean).join(' ')
            return (
              <li key={expense.id} className={rowClass}>
                <span className="exp-icon" aria-hidden="true"><Icon name={expenseIconKey(expense.name)} /></span>
                <div className="exp-name">
                  <div className={`input-wrap${error.name ? ' is-invalid' : ''}`}>
                    <input
                      id={`expense-name-${expense.id}`}
                      type="text"
                      autoComplete="off"
                      maxLength={MAX_EXPENSE_NAME_LENGTH}
                      placeholder="למשל: עיצוב ופרחים"
                      aria-label="שם ההוצאה"
                      aria-invalid={error.name ? 'true' : undefined}
                      aria-describedby={error.name ? nameErrorId : undefined}
                      value={expense.name}
                      onChange={(e) => onUpdate(expense.id, { name: e.target.value })}
                    />
                  </div>
                  {error.name && <p className="error" id={nameErrorId}><Icon name="alert" strokeWidth={2} /><span>{error.name}</span></p>}
                </div>
                <div className="exp-amount">
                  <div className={`input-wrap${error.amount ? ' is-invalid' : ''}`}>
                    <input
                      id={`expense-amount-${expense.id}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      aria-label={`סכום עבור ${label} (₪)`}
                      aria-invalid={error.amount ? 'true' : undefined}
                      aria-describedby={error.amount ? amountErrorId : undefined}
                      value={expense.amount}
                      onChange={(e) => onUpdate(expense.id, { amount: e.target.value })}
                      onBlur={(e) => {
                        const formatted = formatWholeInput(e.target.value)
                        if (formatted !== e.target.value) onUpdate(expense.id, { amount: formatted })
                      }}
                    />
                    <span className="unit" aria-hidden="true">₪</span>
                  </div>
                  {error.amount && <p className="error" id={amountErrorId}><Icon name="alert" strokeWidth={2} /><span>{error.amount}</span></p>}
                </div>
                <button
                  type="button"
                  className="icon-btn danger exp-del"
                  data-role="delete"
                  aria-label={`מחיקת ההוצאה ${label}`}
                  disabled={expense.id === leavingId}
                  onClick={() => handleDelete(expense, index)}
                >
                  <Icon name="trash" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="exp-empty">
          <strong>עוד אין הוצאות נוספות</strong>
          הוסיפו צלם, די-ג׳יי, שמלה או כל דבר אחר שחשוב לכם.
        </div>
      )}

      <div className="exp-actions">
        <button type="button" className="btn btn-dashed" ref={addRef} onClick={handleAdd} disabled={!canAdd} aria-describedby={canAdd ? undefined : 'expenses-limit'}>
          <span className="plus" aria-hidden="true"><Icon name="plus" strokeWidth={2.4} /></span>
          הוספת הוצאה
        </button>
        {!canAdd && <p className="help" id="expenses-limit">אפשר להוסיף עד {MAX_EXPENSES} הוצאות.</p>}
      </div>

      <div className="exp-footer">
        <span className="subtotal-label">סה״כ הוצאות נוספות</span>
        <AnimatedMoney className="subtotal-value" value={expensesTotal} />
      </div>
    </Reveal>
  )
}
