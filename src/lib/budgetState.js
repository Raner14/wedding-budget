/**
 * Calculator state: the raw form strings plus the last valid parsed values.
 * The reducer is pure; IDs for new rows are created by the caller
 * (see `createExpense` / `createFamilyGift`) so it stays deterministic and testable.
 */
import { parseBudget, EVENT_KEYS, RESERVE_MODELS } from './validation.js'

/** Version 2 added reserve guests (billing models) and family gifts. */
export const STATE_VERSION = 2
export const MAX_EXPENSES = 50
export const MAX_FAMILY_GIFTS = 30
/** Illustrative starting attendance rate — not a statistically validated figure. */
export const DEFAULT_ATTENDANCE_RATE = '85'
const DEFAULT_RESERVE_MODEL = 'as-needed'

export function createDefaultEvent() {
  return {
    invitedGuests: '',
    attendanceRate: DEFAULT_ATTENDANCE_RATE,
    mealPrice: '',
    minimumMeals: '',
    averageGift: '',
    reserveModel: DEFAULT_RESERVE_MODEL,
    reserveAvailable: '',
    reserveGuests: '',
    reserveMealPrice: '',
    reserveGift: '',
  }
}

export function createDefaultExpenses() {
  return [
    { id: 'dj', name: 'די-ג׳יי', amount: '' },
    { id: 'photographer', name: 'צלם', amount: '' },
    { id: 'dress', name: 'שמלת כלה', amount: '' },
  ]
}

export function createDefaultFamilyGifts() {
  return { enabled: false, items: [] }
}

export function createDefaultNotices() {
  return { reserveMigrated: false }
}

const newId = (prefix) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Creates a new, empty expense with a unique ID. */
export function createExpense() {
  return { id: newId('e'), name: '', amount: '' }
}

/** Creates a new family gift row with a unique ID. */
export function createFamilyGift(label = '') {
  return { id: newId('f'), label, amount: '' }
}

/** Suggested rows when family gifts are switched on for the first time. */
export function createSuggestedFamilyGifts() {
  return [createFamilyGift('הורי הכלה'), createFamilyGift('הורי החתן')]
}

/**
 * Recomputes `lastValidValues`: updated when the input is valid and non-empty,
 * cleared when the form is empty, and kept as-is while there are errors.
 */
function withLastValid(state) {
  const parsed = parseBudget(state)
  if (parsed.errorCount > 0) return state
  return { ...state, lastValidValues: parsed.isEmpty ? null : parsed.values }
}

/**
 * Builds a full reducer state from persisted data.
 * @param {{ event: object, expenses: object[], familyGifts?: object, notices?: object }} [data]
 */
export function createInitialState(data) {
  return withLastValid({
    event: data?.event ?? createDefaultEvent(),
    expenses: data?.expenses ?? createDefaultExpenses(),
    familyGifts: data?.familyGifts ?? createDefaultFamilyGifts(),
    notices: data?.notices ?? createDefaultNotices(),
    lastValidValues: null,
  })
}

export const actions = {
  fieldChanged: (field, value) => ({ type: 'fieldChanged', field, value }),
  expenseAdded: (expense) => ({ type: 'expenseAdded', expense }),
  expenseUpdated: (id, patch) => ({ type: 'expenseUpdated', id, patch }),
  expenseRemoved: (id) => ({ type: 'expenseRemoved', id }),
  expenseRestored: (expense, index) => ({ type: 'expenseRestored', expense, index }),
  /** `suggested` rows are added only when switching on an empty list. */
  familyGiftsToggled: (enabled, suggested = []) => ({ type: 'familyGiftsToggled', enabled, suggested }),
  familyGiftAdded: (gift) => ({ type: 'familyGiftAdded', gift }),
  familyGiftUpdated: (id, patch) => ({ type: 'familyGiftUpdated', id, patch }),
  familyGiftRemoved: (id) => ({ type: 'familyGiftRemoved', id }),
  reserveNoticeDismissed: () => ({ type: 'reserveNoticeDismissed' }),
  reset: () => ({ type: 'reset' }),
}

/** Copies only the allowed string fields from a patch; IDs are immutable. */
function pickStrings(patch, keys) {
  const out = {}
  for (const key of keys) if (typeof patch[key] === 'string') out[key] = patch[key]
  return out
}

function applyAction(state, action) {
  switch (action.type) {
    case 'fieldChanged':
      if (!EVENT_KEYS.includes(action.field)) return state
      if (action.field === 'reserveModel' && !RESERVE_MODELS.includes(action.value)) return state
      return { ...state, event: { ...state.event, [action.field]: action.value } }

    case 'expenseAdded':
      if (state.expenses.length >= MAX_EXPENSES) return state
      return { ...state, expenses: [...state.expenses, action.expense] }

    case 'expenseUpdated':
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.id ? { ...e, ...pickStrings(action.patch, ['name', 'amount']) } : e)),
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

    case 'familyGiftsToggled': {
      const { familyGifts } = state
      if (familyGifts.enabled === action.enabled) return state
      const items = action.enabled && familyGifts.items.length === 0 ? action.suggested.slice(0, MAX_FAMILY_GIFTS) : familyGifts.items
      return { ...state, familyGifts: { enabled: action.enabled, items } }
    }

    case 'familyGiftAdded':
      if (state.familyGifts.items.length >= MAX_FAMILY_GIFTS) return state
      return { ...state, familyGifts: { ...state.familyGifts, items: [...state.familyGifts.items, action.gift] } }

    case 'familyGiftUpdated':
      return {
        ...state,
        familyGifts: {
          ...state.familyGifts,
          items: state.familyGifts.items.map((g) => (g.id === action.id ? { ...g, ...pickStrings(action.patch, ['label', 'amount']) } : g)),
        },
      }

    case 'familyGiftRemoved':
      if (!state.familyGifts.items.some((g) => g.id === action.id)) return state
      return { ...state, familyGifts: { ...state.familyGifts, items: state.familyGifts.items.filter((g) => g.id !== action.id) } }

    case 'reserveNoticeDismissed':
      if (!state.notices.reserveMigrated) return state
      return { ...state, notices: { ...state.notices, reserveMigrated: false } }

    case 'reset':
      return createInitialState()

    default:
      return state
  }
}

export function budgetReducer(state, action) {
  const next = applyAction(state, action)
  return next === state ? state : withLastValid(next)
}

/** The persisted subset of the state (derived values are never stored). */
export function toPersisted(state) {
  return {
    version: STATE_VERSION,
    event: state.event,
    expenses: state.expenses,
    familyGifts: state.familyGifts,
    notices: state.notices,
  }
}
