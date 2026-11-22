/**
 * Calculator state: the raw form strings plus the last valid parsed values.
 * The reducer is pure; IDs for new expenses are created by the caller
 * (see `createExpense`) so the reducer stays deterministic and testable.
 */
import { parseBudget, EVENT_FIELDS } from './validation.js'

export const STATE_VERSION = 1
export const MAX_EXPENSES = 50
/** Illustrative starting attendance rate — not a statistically validated figure. */
export const DEFAULT_ATTENDANCE_RATE = '85'

export function createDefaultEvent() {
  return {
    invitedGuests: '',
    attendanceRate: DEFAULT_ATTENDANCE_RATE,
    mealPrice: '',
    minimumMeals: '',
    reserveMeals: '',
    reserveMealPrice: '',
    averageGift: '',
  }
}

export function createDefaultExpenses() {
  return [
    { id: 'dj', name: 'די-ג׳יי', amount: '' },
    { id: 'photographer', name: 'צלם', amount: '' },
    { id: 'dress', name: 'שמלת כלה', amount: '' },
  ]
}

/** Creates a new, empty expense with a unique ID. */
export function createExpense() {
  const id = globalThis.crypto?.randomUUID?.() ?? `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return { id, name: '', amount: '' }
}

/**
 * Recomputes `lastValidValues`: updated when the input is valid and non-empty,
 * cleared when the form is empty, and kept as-is while there are errors.
 */
function withLastValid(state) {
  const parsed = parseBudget(state)
  if (parsed.errorCount > 0) return state
  const lastValidValues = parsed.isEmpty ? null : parsed.values
  return { ...state, lastValidValues }
}

/**
 * Builds a full reducer state from persisted `{ event, expenses }` data.
 * @param {{ event: object, expenses: object[] }} [data]
 */
export function createInitialState(data) {
  const base = data ?? { event: createDefaultEvent(), expenses: createDefaultExpenses() }
  return withLastValid({ event: base.event, expenses: base.expenses, lastValidValues: null })
}

export const actions = {
  fieldChanged: (field, value) => ({ type: 'fieldChanged', field, value }),
  expenseAdded: (expense) => ({ type: 'expenseAdded', expense }),
  expenseUpdated: (id, patch) => ({ type: 'expenseUpdated', id, patch }),
  expenseRemoved: (id) => ({ type: 'expenseRemoved', id }),
  expenseRestored: (expense, index) => ({ type: 'expenseRestored', expense, index }),
  reset: () => ({ type: 'reset' }),
}

function applyAction(state, action) {
  switch (action.type) {
    case 'fieldChanged':
      if (!EVENT_FIELDS.includes(action.field)) return state
      return { ...state, event: { ...state.event, [action.field]: action.value } }

    case 'expenseAdded':
      if (state.expenses.length >= MAX_EXPENSES) return state
      return { ...state, expenses: [...state.expenses, action.expense] }

    case 'expenseUpdated':
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.id ? { ...e, ...pick(action.patch) } : e)),
      }

    case 'expenseRemoved':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) }

    case 'expenseRestored': {
      if (state.expenses.some((e) => e.id === action.expense.id)) return state
      const index = Math.max(0, Math.min(action.index, state.expenses.length))
      const expenses = [...state.expenses]
      expenses.splice(index, 0, action.expense)
      return { ...state, expenses }
    }

    case 'reset':
      return { event: createDefaultEvent(), expenses: createDefaultExpenses(), lastValidValues: null }

    default:
      return state
  }
}

/** Only `name` and `amount` may be patched on an expense; the id is immutable. */
function pick(patch) {
  const out = {}
  if (typeof patch.name === 'string') out.name = patch.name
  if (typeof patch.amount === 'string') out.amount = patch.amount
  return out
}

export function budgetReducer(state, action) {
  const next = applyAction(state, action)
  return next === state ? state : withLastValid(next)
}

/** The persisted subset of the state (derived values are never stored). */
export function toPersisted(state) {
  return { version: STATE_VERSION, event: state.event, expenses: state.expenses }
}
