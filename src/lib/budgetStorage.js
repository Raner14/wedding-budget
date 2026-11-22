/**
 * Versioned persistence for the calculator. Loading never trusts stored data:
 * every field is type-checked and length-limited ("sanitized"). Business
 * validation is NOT done here — an invalid but well-formed value such as "12א"
 * is restored as typed so the user sees the field error instead of silent loss.
 */
import { readJSON, writeJSON } from './safeStorage.js'
import {
  createDefaultEvent,
  createDefaultExpenses,
  createExpense,
  createInitialState,
  MAX_EXPENSES,
  STATE_VERSION,
  toPersisted,
} from './budgetState.js'
import { EVENT_FIELDS, MAX_EXPENSE_NAME_LENGTH } from './validation.js'

export const BUDGET_STORAGE_KEY = 'wedding-budget:v1'
const MAX_VALUE_LENGTH = 20
const MAX_ID_LENGTH = 64

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v, max, fallback) => (typeof v === 'string' ? v.slice(0, max) : fallback)

/**
 * @param {unknown} data
 * @returns {{ event: object, expenses: object[] } | null} Null when the data is unusable.
 */
export function sanitizeBudget(data) {
  if (!isObject(data) || data.version !== STATE_VERSION) return null

  const defaults = createDefaultEvent()
  const storedEvent = isObject(data.event) ? data.event : {}
  const event = {}
  for (const field of EVENT_FIELDS) event[field] = str(storedEvent[field], MAX_VALUE_LENGTH, defaults[field])

  const seen = new Set()
  const expenses = (Array.isArray(data.expenses) ? data.expenses : [])
    .filter(isObject)
    .slice(0, MAX_EXPENSES)
    .map((item) => {
      let id = typeof item.id === 'string' && item.id !== '' ? item.id.slice(0, MAX_ID_LENGTH) : ''
      if (id === '' || seen.has(id)) id = createExpense().id
      seen.add(id)
      return {
        id,
        name: str(item.name, MAX_EXPENSE_NAME_LENGTH, ''),
        amount: str(item.amount, MAX_VALUE_LENGTH, ''),
      }
    })

  return { event, expenses }
}

/** Lazy initializer for useReducer: stored state, or defaults when missing/corrupted. */
export function loadBudget() {
  const data = sanitizeBudget(readJSON(BUDGET_STORAGE_KEY))
  return createInitialState(data ?? { event: createDefaultEvent(), expenses: createDefaultExpenses() })
}

/** @returns {boolean} Whether saving succeeded. */
export function saveBudget(state) {
  return writeJSON(BUDGET_STORAGE_KEY, toPersisted(state))
}
