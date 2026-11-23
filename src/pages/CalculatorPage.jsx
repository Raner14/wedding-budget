import { useEffect, useReducer, useState } from 'react'
import { flushSync } from 'react-dom'
import { Blossom } from '../components/Botanicals.jsx'
import Hero from '../components/Hero.jsx'
import Reveal from '../components/Reveal.jsx'
import Dock from '../components/Dock.jsx'
import Icon from '../components/Icon.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import UndoToast from '../components/UndoToast.jsx'
import EventDetailsForm from '../components/calculator/EventDetailsForm.jsx'
import ExpensesList from '../components/calculator/ExpensesList.jsx'
import BudgetSummary from '../components/calculator/BudgetSummary.jsx'
import MobileBalanceBar from '../components/calculator/MobileBalanceBar.jsx'
import WhatIfPanel from '../components/calculator/WhatIfPanel.jsx'
import {
  actions,
  budgetReducer,
  createExpense,
  createSuggestedFamilyGifts,
  PREPAID_RESERVE_EXPENSE_NAME,
} from '../lib/budgetState.js'
import { formatNumber } from '../lib/format.js'
import { loadBudget, saveBudget } from '../lib/budgetStorage.js'
import { isStorageAvailable } from '../lib/safeStorage.js'
import { parseBudget, parseWhole } from '../lib/validation.js'
import { calculateAttendingGuests } from '../lib/budget.js'
import { UNDO_TIMEOUT_MS } from '../components/undo.js'
import './CalculatorPage.css'

/**
 * Expected guests, shown as soon as the inputs they depend on are valid: the base
 * estimate needs invited + rate; reserve guests are added once the reserve fields are valid.
 */
function attendingFrom(event, parsed) {
  const { errors, eventResult } = parsed
  if (eventResult) return { base: eventResult.baseGuests, reserve: eventResult.reserveGuests }
  if (errors.event.invitedGuests || errors.event.attendanceRate) return null
  return { base: calculateAttendingGuests(parseWhole(event.invitedGuests).value, parseWhole(event.attendanceRate).value), reserve: 0 }
}

export default function CalculatorPage() {
  const [state, dispatch] = useReducer(budgetReducer, undefined, loadBudget)
  const { event, expenses, familyGifts, notices, lastValidValues } = state
  /** Only the most recent deletion can be undone. */
  const [pendingUndo, setPendingUndo] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [canSave] = useState(isStorageAvailable)
  /** Bumped by "start over" so temporary UI state (scenario sliders) resets too. */
  const [resetCount, setResetCount] = useState(0)

  // Persist the raw input on every change. Failures are tolerated (private mode, quota).
  useEffect(() => {
    saveBudget({ event, expenses, familyGifts, notices })
  }, [event, expenses, familyGifts, notices])

  // Auto-dismiss the undo toast. A newer deletion replaces it and restarts the timer.
  useEffect(() => {
    if (!pendingUndo) return undefined
    const timer = setTimeout(() => setPendingUndo(null), UNDO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [pendingUndo])

  const parsed = parseBudget(state)
  const scenarioValues = parsed.errorCount === 0 && !parsed.isEmpty ? parsed.values : null

  function handleAddExpense(expense) {
    dispatch(actions.expenseAdded(expense))
    setHighlightId(expense.id)
  }

  /** Migration notice: keep the old prepaid reserve cost as an explicit expense row. */
  function handleAddPrepaidReserveExpense() {
    const amount = notices.prepaidReserve?.suggestedExpense
    if (!amount) return
    const expense = { ...createExpense(), name: PREPAID_RESERVE_EXPENSE_NAME, amount: formatNumber(amount) }
    dispatch(actions.prepaidReserveExpenseAdded(expense))
    setHighlightId(expense.id)
  }

  function handleRemoveExpense(expense, index) {
    dispatch(actions.expenseRemoved(expense.id))
    setPendingUndo({ expense, index })
  }

  function handleUndo() {
    if (!pendingUndo) return
    const { expense, index } = pendingUndo
    flushSync(() => {
      dispatch(actions.expenseRestored(expense, index))
      setHighlightId(expense.id)
      setPendingUndo(null)
    })
    document.getElementById(`expense-name-${expense.id}`)?.focus()
  }

  function handleResetAll() {
    if (!window.confirm('למחוק את כל הנתונים ולהתחיל מחדש?')) return
    flushSync(() => {
      dispatch(actions.reset())
      setResetCount((n) => n + 1)
      setPendingUndo(null)
      setHighlightId(null)
    })
    document.getElementById('field-invitedGuests')?.focus()
  }

  return (
    <>
      <div className="app-inner">
        <Hero />

        <main id="main-content" tabIndex={-1}>
          <Reveal className="section-intro" id="calculator">
            <div className="ornament" aria-hidden="true"><Blossom /></div>
            <p className="kicker">המחשבון שלנו</p>
            <h2 className="section-title">כמה תעלה החתונה, וכמה תחזיר?</h2>
            <p className="section-sub">ממלאים כמה פרטים, והמאזן מתעדכן מיד. אפשר לשנות כל דבר בכל רגע.</p>
          </Reveal>

          <div className="layout">
            <div className="col-inputs">
              <EventDetailsForm
                event={event}
                errors={parsed.errors.event}
                attending={attendingFrom(event, parsed)}
                onFieldChange={(field, value) => dispatch(actions.fieldChanged(field, value))}
                reserve={{
                  info: parsed.eventResult,
                  notice: notices.prepaidReserve,
                  onDismissNotice: () => dispatch(actions.reserveNoticeDismissed()),
                  onAddPrepaidExpense: handleAddPrepaidReserveExpense,
                }}
                family={{
                  familyGifts,
                  errors: parsed.errors.family,
                  total: parsed.familyTotal,
                  onToggle: (enabled) => dispatch(actions.familyGiftsToggled(enabled, enabled ? createSuggestedFamilyGifts() : [])),
                  onAdd: (gift) => dispatch(actions.familyGiftAdded(gift)),
                  onUpdate: (id, patch) => dispatch(actions.familyGiftUpdated(id, patch)),
                  onRemove: (id) => dispatch(actions.familyGiftRemoved(id)),
                }}
              />
              <ExpensesList
                expenses={expenses}
                errors={parsed.errors.expenses}
                venueCost={parsed.venueCost}
                expensesTotal={parsed.expensesTotal}
                highlightId={highlightId}
                onAdd={handleAddExpense}
                onUpdate={(id, patch) => dispatch(actions.expenseUpdated(id, patch))}
                onRemove={handleRemoveExpense}
              />
            </div>
            <BudgetSummary parsed={parsed} lastValidValues={lastValidValues} />
          </div>
          <WhatIfPanel
            key={resetCount}
            values={scenarioValues}
            disabledReason={parsed.errorCount > 0 ? 'יש לתקן את השדות המסומנים כדי לבחון תרחישים.' : 'הזינו פרטי אירוע כדי לבחון תרחישים.'}
          />
        </main>

        <SiteFooter>
          {!canSave && (
            <div className="alert alert-warn storage-warning" role="alert">
              <Icon name="warning" strokeWidth={2} />
              <p>הדפדפן לא מאפשר לשמור נתונים, ולכן הם יימחקו ברענון הדף.</p>
            </div>
          )}
          <p>
            התוצאות הן הערכה בלבד ואינן מהוות ייעוץ פיננסי. כל המחירים כוללים מע״מ.
            <br />
            הנתונים נשמרים רק בדפדפן שלכם ולא נשלחים לשום שרת.
          </p>
          <button type="button" className="btn btn-ghost" onClick={handleResetAll}>התחל מחדש</button>
        </SiteFooter>
      </div>

      <Dock>
        {pendingUndo && (
          <UndoToast
            key={pendingUndo.expense.id}
            message={`ההוצאה „${pendingUndo.expense.name.trim() || 'ללא שם'}” נמחקה`}
            onUndo={handleUndo}
            onClose={() => setPendingUndo(null)}
          />
        )}
        <MobileBalanceBar parsed={parsed} lastValidValues={lastValidValues} />
      </Dock>
    </>
  )
}
