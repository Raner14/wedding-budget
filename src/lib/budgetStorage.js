/**
 * Versioned persistence for the calculator. Loading never trusts stored data:
 * every field is type-checked and length-limited ("sanitized"). Business
 * validation is NOT done here — an invalid but well-formed value such as "12א"
 * is restored as typed so the user sees the field error instead of silent loss.
 *
 * Storage keys (newest first):
 *  - `wedding-budget:v3` (current)  — written on every change.
 *  - `wedding-budget:v2` (previous) — reserve billing models "as needed" / "prepaid".
 *  - `wedding-budget:v1` (legacy)   — cost-only "reserve meals".
 * Older keys are read once (only when no newer data exists) and migrated. They are
 * never written or deleted, so an older version of the site (e.g. a rollback) still
 * finds the user's data exactly as it left it.
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
import { EVENT_FIELDS, MAX_EXPENSE_NAME_LENGTH, MAX_FAMILY_LABEL_LENGTH, parseBudget, parseWhole } from './validation.js'

export const BUDGET_STORAGE_KEY = 'wedding-budget:v3'
export const PREVIOUS_BUDGET_STORAGE_KEY = 'wedding-budget:v2'
export const LEGACY_BUDGET_STORAGE_KEY = 'wedding-budget:v1'
const MAX_VALUE_LENGTH = 20
const MAX_ID_LENGTH = 64
const MAX_STORED_AMOUNT = 100_000_000_000

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v, max, fallback) => (typeof v === 'string' ? v.slice(0, max) : fallback)
const amountOrNull = (v) => (Number.isInteger(v) && v >= 0 && v <= MAX_STORED_AMOUNT ? v : null)

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

function sanitizeFamilyGifts(data) {
  const family = isObject(data) ? data : {}
  return {
    enabled: family.enabled === true,
    items: sanitizeRows(family.items, {
      max: MAX_FAMILY_GIFTS, nameKey: 'label', nameMax: MAX_FAMILY_LABEL_LENGTH, makeId: () => createFamilyGift().id,
    }),
  }
}

/** Event fields of the current format, from any stored event object (unknown keys dropped). */
function sanitizeEvent(stored) {
  const defaults = createDefaultEvent()
  const source = isObject(stored) ? stored : {}
  const event = {}
  for (const field of EVENT_FIELDS) event[field] = str(source[field], MAX_VALUE_LENGTH, defaults[field])
  return event
}

function sanitizeNotice(notice) {
  if (!isObject(notice)) return null
  return {
    meals: str(notice.meals, MAX_VALUE_LENGTH, ''),
    previousCost: amountOrNull(notice.previousCost),
    suggestedExpense: amountOrNull(notice.suggestedExpense),
  }
}

/**
 * Current format (version 3).
 * @param {unknown} data
 * @returns {{ event: object, expenses: object[], familyGifts: object, notices: object } | null}
 */
export function sanitizeBudget(data) {
  if (!isObject(data) || data.version !== STATE_VERSION) return null
  return {
    event: sanitizeEvent(data.event),
    expenses: sanitizeExpenses(data.expenses),
    familyGifts: sanitizeFamilyGifts(data.familyGifts),
    notices: { prepaidReserve: sanitizeNotice(isObject(data.notices) ? data.notices.prepaidReserve : null) },
  }
}

/**
 * Prepaid reserve meals no longer exist: only reserve guests who come are paid for.
 * Everything the user entered is kept; for the explanation we compute what the prepaid
 * meals used to cost and the expense that would restore the previous balance exactly
 * (previous cost − what the new rules already charge). Both are null when the stored
 * values are not valid numbers.
 *
 * @param {object} migrated  The data already converted to the current shape.
 * @param {string} meals     Stored number of prepaid reserve meals (raw string).
 */
function withPrepaidReserveNotice(migrated, meals) {
  const parsed = parseBudget(migrated)
  const count = parseWhole(meals)
  let previousCost = null
  let suggestedExpense = null
  if (parsed.eventResult && 'value' in count) {
    previousCost = count.value * parsed.eventResult.reserveMealPrice
    suggestedExpense = Math.max(0, previousCost - parsed.eventResult.reserveCost)
  }
  return { ...migrated, notices: { prepaidReserve: { meals, previousCost, suggestedExpense } } }
}

const hasReserveMeals = (raw) => raw.trim() !== '' && raw.trim() !== '0'

/**
 * Previous format (version 2): drops the billing model. "As needed" budgets are unchanged;
 * "prepaid" budgets keep their reserve places and guests and get the explanation notice.
 * @param {unknown} data
 */
export function migratePreviousBudget(data) {
  if (!isObject(data) || data.version !== 2) return null
  const migrated = {
    event: sanitizeEvent(data.event),
    expenses: sanitizeExpenses(data.expenses),
    familyGifts: sanitizeFamilyGifts(data.familyGifts),
    notices: createDefaultNotices(),
  }
  const stored = isObject(data.event) ? data.event : {}
  return stored.reserveModel === 'prepaid' && hasReserveMeals(migrated.event.reserveAvailable)
    ? withPrepaidReserveNotice(migrated, migrated.event.reserveAvailable)
    : migrated
}

/**
 * Legacy format (version 1): `reserveMeals` × `reserveMealPrice` were extra meals the
 * couple expected to pay for, with no extra guests — i.e. prepaid reserve meals. They
 * become reserve places (with no expected guests yet) plus the explanation notice.
 * @param {unknown} data
 */
export function migrateLegacyBudget(data) {
  if (!isObject(data) || data.version !== 1) return null
  const stored = isObject(data.event) ? data.event : {}
  const keep = (field) => str(stored[field], MAX_VALUE_LENGTH, '')
  const defaults = createDefaultEvent()
  const reserveMeals = keep('reserveMeals')
  const hadReserve = hasReserveMeals(reserveMeals)
  const migrated = {
    event: {
      ...defaults,
      invitedGuests: keep('invitedGuests'),
      attendanceRate: str(stored.attendanceRate, MAX_VALUE_LENGTH, defaults.attendanceRate),
      mealPrice: keep('mealPrice'),
      minimumMeals: keep('minimumMeals'),
      averageGift: keep('averageGift'),
      reserveAvailable: hadReserve ? reserveMeals : '',
      reserveMealPrice: hadReserve ? keep('reserveMealPrice') : '',
    },
    expenses: sanitizeExpenses(data.expenses),
    familyGifts: createDefaultFamilyGifts(),
    notices: createDefaultNotices(),
  }
  return hadReserve ? withPrepaidReserveNotice(migrated, reserveMeals) : migrated
}

/** Lazy initializer for useReducer: newest stored data, migrating older formats once. */
export function loadBudget() {
  const data =
    sanitizeBudget(readJSON(BUDGET_STORAGE_KEY)) ??
    migratePreviousBudget(readJSON(PREVIOUS_BUDGET_STORAGE_KEY)) ??
    migrateLegacyBudget(readJSON(LEGACY_BUDGET_STORAGE_KEY))
  return createInitialState(data ?? { event: createDefaultEvent(), expenses: createDefaultExpenses() })
}

/** Writes the current format only; older keys are never modified. @returns {boolean} */
export function saveBudget(state) {
  return writeJSON(BUDGET_STORAGE_KEY, toPersisted(state))
}
