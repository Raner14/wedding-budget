/**
 * Versioned persistence for the calculator. Loading never trusts stored data:
 * every field is type-checked and length-limited ("sanitized"). Business
 * validation is NOT done here — an invalid but well-formed value such as "12א"
 * is restored as typed so the user sees the field error instead of silent loss.
 *
 * Storage keys:
 *  - `wedding-budget:v2` (current) — written on every change.
 *  - `wedding-budget:v1` (legacy)  — read once if v2 is missing, then migrated.
 *    It is never written or deleted, so an older version of the site (e.g. a
 *    rollback) still finds the user's original data untouched.
 */
import { readJSON, writeJSON } from './safeStorage.js'
import {
  createDefaultEvent,
  createDefaultExpenses,
  createDefaultFamilyGifts,
  createDefaultNotices,
  createExpense,
  createFamilyGift,
  createInitialState,
  MAX_EXPENSES,
  MAX_FAMILY_GIFTS,
  STATE_VERSION,
  toPersisted,
} from './budgetState.js'
import { EVENT_FIELDS, MAX_EXPENSE_NAME_LENGTH, MAX_FAMILY_LABEL_LENGTH, RESERVE_MODELS } from './validation.js'

export const BUDGET_STORAGE_KEY = 'wedding-budget:v2'
export const LEGACY_BUDGET_STORAGE_KEY = 'wedding-budget:v1'
const MAX_VALUE_LENGTH = 20
const MAX_ID_LENGTH = 64

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v, max, fallback) => (typeof v === 'string' ? v.slice(0, max) : fallback)

/** Sanitizes a list of `{ id, <nameKey>, amount }` rows, repairing missing/duplicate IDs. */
function sanitizeRows(list, { max, nameKey, nameMax, makeId }) {
  const seen = new Set()
  return (Array.isArray(list) ? list : [])
    .filter(isObject)
    .slice(0, max)
    .map((item) => {
      let id = typeof item.id === 'string' && item.id !== '' ? item.id.slice(0, MAX_ID_LENGTH) : ''
      if (id === '' || seen.has(id)) id = makeId()
      seen.add(id)
      return { id, [nameKey]: str(item[nameKey], nameMax, ''), amount: str(item.amount, MAX_VALUE_LENGTH, '') }
    })
}

const sanitizeExpenses = (list) =>
  sanitizeRows(list, { max: MAX_EXPENSES, nameKey: 'name', nameMax: MAX_EXPENSE_NAME_LENGTH, makeId: () => createExpense().id })

/**
 * Current format (version 2).
 * @param {unknown} data
 * @returns {{ event: object, expenses: object[], familyGifts: object, notices: object } | null}
 */
export function sanitizeBudget(data) {
  if (!isObject(data) || data.version !== STATE_VERSION) return null

  const defaults = createDefaultEvent()
  const stored = isObject(data.event) ? data.event : {}
  const event = {}
  for (const field of EVENT_FIELDS) event[field] = str(stored[field], MAX_VALUE_LENGTH, defaults[field])
  event.reserveModel = RESERVE_MODELS.includes(stored.reserveModel) ? stored.reserveModel : defaults.reserveModel

  const family = isObject(data.familyGifts) ? data.familyGifts : {}
  const familyGifts = {
    enabled: family.enabled === true,
    items: sanitizeRows(family.items, {
      max: MAX_FAMILY_GIFTS, nameKey: 'label', nameMax: MAX_FAMILY_LABEL_LENGTH, makeId: () => createFamilyGift().id,
    }),
  }
  const notices = { reserveMigrated: isObject(data.notices) && data.notices.reserveMigrated === true }

  return { event, expenses: sanitizeExpenses(data.expenses), familyGifts, notices }
}

/**
 * Legacy format (version 1) → version 2.
 *
 * Version 1 had `reserveMeals` × `reserveMealPrice`: extra meals the couple expected
 * to pay for, with no extra guests and no extra gifts. That is exactly a PREPAID
 * reserve with zero reserve guests, so every result stays identical. A one-time notice
 * tells the user how their reserve was carried over. All other fields are kept as typed.
 *
 * @param {unknown} data
 * @returns {{ event: object, expenses: object[], familyGifts: object, notices: object } | null}
 */
export function migrateLegacyBudget(data) {
  if (!isObject(data) || data.version !== 1) return null
  const defaults = createDefaultEvent()
  const stored = isObject(data.event) ? data.event : {}
  const keep = (field) => str(stored[field], MAX_VALUE_LENGTH, defaults[field] ?? '')

  const reserveMeals = keep('reserveMeals') // no v2 default: missing → ''
  const hadReserve = reserveMeals.trim() !== '' && reserveMeals.trim() !== '0'
  const event = {
    ...defaults,
    invitedGuests: keep('invitedGuests'),
    attendanceRate: keep('attendanceRate'),
    mealPrice: keep('mealPrice'),
    minimumMeals: keep('minimumMeals'),
    averageGift: keep('averageGift'),
    reserveModel: hadReserve ? 'prepaid' : defaults.reserveModel,
    reserveAvailable: hadReserve ? reserveMeals : '',
    reserveGuests: '',
    reserveMealPrice: hadReserve ? keep('reserveMealPrice') : '',
    reserveGift: '',
  }
  return {
    event,
    expenses: sanitizeExpenses(data.expenses),
    familyGifts: createDefaultFamilyGifts(),
    notices: { ...createDefaultNotices(), reserveMigrated: hadReserve },
  }
}

/** Lazy initializer for useReducer: current data, else migrated legacy data, else defaults. */
export function loadBudget() {
  const current = sanitizeBudget(readJSON(BUDGET_STORAGE_KEY))
  if (current) return createInitialState(current)
  const legacy = migrateLegacyBudget(readJSON(LEGACY_BUDGET_STORAGE_KEY))
  if (legacy) return createInitialState(legacy)
  return createInitialState({ event: createDefaultEvent(), expenses: createDefaultExpenses() })
}

/** Writes the current format only; the legacy key is never modified. @returns {boolean} */
export function saveBudget(state) {
  return writeJSON(BUDGET_STORAGE_KEY, toPersisted(state))
}
