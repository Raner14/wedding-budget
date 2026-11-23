/**
 * Converts the raw form state (strings exactly as typed) into validated numbers
 * for `budget.js`, plus field-level Hebrew error messages.
 *
 * The state keeps strings so we can tell "empty" from 0 and show an error on
 * input like "12א" without losing what the user typed.
 */
import { calculateBudget } from './budget.js'
import { formatNumber } from './format.js'

export const MAX_COUNT = 5_000
export const MAX_MONEY = 10_000_000
export const MAX_EXPENSE_NAME_LENGTH = 60
export const MAX_FAMILY_LABEL_LENGTH = 60

export const MESSAGES = {
  notWhole: 'יש להזין מספר שלם, למשל 15,000',
  maxCount: 'המספר המקסימלי הוא 5,000',
  maxMoney: 'הסכום המקסימלי הוא ₪10,000,000',
  rateRange: 'אחוז ההגעה צריך להיות בין 0 ל-100',
  reserveGuestsOverAvailable: (available) =>
    available === 0 ? 'קודם צריך להזין כמה מקומות רזרבה יש' : `לא יותר ממספר מקומות הרזרבה (${formatNumber(available)})`,
  familyLabelRequired: 'יש לכתוב ממי המתנה',
  familyLabelTooLong: `התיאור יכול להכיל עד ${MAX_FAMILY_LABEL_LENGTH} תווים`,
  expenseNameRequired: 'יש להזין שם להוצאה',
  expenseNameTooLong: `שם ההוצאה יכול להכיל עד ${MAX_EXPENSE_NAME_LENGTH} תווים`,
}

/**
 * Numeric event fields, keyed by state/value field name.
 * `optional`: an empty field means "same as the regular value" and parses to null.
 */
export const EVENT_FIELD_RULES = {
  invitedGuests: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  attendanceRate: { max: 100, maxMessage: MESSAGES.rateRange },
  mealPrice: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney },
  minimumMeals: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  averageGift: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney },
  reserveAvailable: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  reserveGuests: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  reserveMealPrice: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney, optional: true },
  reserveGift: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney, optional: true },
}

export const EVENT_FIELDS = Object.keys(EVENT_FIELD_RULES)

/** Plain digits, or digits with correctly placed thousands separators ("15,000", "1 234 567"). */
const WHOLE_NUMBER = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+)$/

/**
 * Parses a whole, non-negative number. An empty string means 0.
 * Separators are accepted only in real thousands positions, so a decimal comma
 * such as "350,5" is rejected instead of silently becoming 3,505.
 * @param {string} raw
 * @returns {{ value: number } | { error: string }}
 */
export function parseWhole(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return { value: 0 }
  if (!WHOLE_NUMBER.test(text)) return { error: MESSAGES.notWhole }
  return { value: Number(text.replace(/[, ]/g, '')) }
}

/**
 * Display formatting applied when a whole-number field loses focus:
 * "15000" → "15,000". Empty or invalid input is returned unchanged so the
 * user's text (and its error) is never lost.
 * @param {string} raw
 * @returns {string}
 */
export function formatWholeInput(raw) {
  if (String(raw ?? '').trim() === '') return raw
  const parsed = parseWhole(raw)
  return 'value' in parsed ? formatNumber(parsed.value) : raw
}

/** Validates a money amount; returns { value } or { error }. */
function parseMoney(raw) {
  const parsed = parseWhole(raw)
  if ('error' in parsed) return parsed
  if (parsed.value > MAX_MONEY) return { error: MESSAGES.maxMoney }
  return parsed
}

/**
 * Validates a list of named amounts (expenses, family gifts). A name is required only
 * once the row has an amount, so a freshly added empty row is never an error.
 */
function parseNamedAmounts(items, nameKey, { maxLength, tooLong, required }) {
  const errors = {}
  let errorCount = 0
  const values = items.map((item) => {
    const fieldErrors = {}
    const parsed = parseMoney(item.amount)
    const amount = 'value' in parsed ? parsed.value : 0
    if ('error' in parsed) fieldErrors.amount = parsed.error

    const name = item[nameKey].trim()
    if (name.length > maxLength) fieldErrors[nameKey] = tooLong
    else if (name === '' && amount > 0) fieldErrors[nameKey] = required

    const count = Object.keys(fieldErrors).length
    if (count > 0) {
      errors[item.id] = fieldErrors
      errorCount += count
    }
    return { id: item.id, [nameKey]: item[nameKey], amount }
  })
  const amountsValid = Object.values(errors).every((e) => !e.amount)
  return { values, errors, errorCount, total: amountsValid ? values.reduce((sum, v) => sum + v.amount, 0) : null }
}

/**
 * @typedef {Object} ParsedBudget
 * @property {import('./budget.js').BudgetValues | null} values  Null when any field is invalid.
 * @property {{ event: Record<string, string>, expenses: Record<string, object>, family: Record<string, object> }} errors
 * @property {number} errorCount
 * @property {boolean} isEmpty   True when there is nothing to calculate yet.
 * @property {object | null} eventResult    Venue & reserve result (no expenses or family gifts), as soon as the event fields are valid.
 * @property {number | null} venueCost      Available as soon as the event fields are valid.
 * @property {number | null} expensesTotal  Sum of additional expenses; null while an amount is invalid.
 * @property {number | null} familyTotal    Sum of family gifts (0 when disabled); null while an amount is invalid.
 */

/**
 * @param {{
 *   event: Record<string, string>,
 *   expenses: {id: string, name: string, amount: string}[],
 *   familyGifts: { enabled: boolean, items: {id: string, label: string, amount: string}[] },
 * }} state
 * @returns {ParsedBudget}
 */
export function parseBudget(state) {
  const errors = { event: {}, expenses: {}, family: {} }
  let errorCount = 0
  const values = {}

  for (const field of EVENT_FIELDS) {
    const rule = EVENT_FIELD_RULES[field]
    const raw = state.event[field]
    if (rule.optional && String(raw ?? '').trim() === '') {
      values[field] = null
      continue
    }
    const parsed = parseWhole(raw)
    if ('error' in parsed) errors.event[field] = parsed.error
    else if (parsed.value > rule.max) errors.event[field] = rule.maxMessage
    else values[field] = parsed.value
    if (errors.event[field]) errorCount++
  }

  const reserveCountsValid = !errors.event.reserveAvailable && !errors.event.reserveGuests
  if (reserveCountsValid && values.reserveGuests > values.reserveAvailable) {
    errors.event.reserveGuests = MESSAGES.reserveGuestsOverAvailable(values.reserveAvailable)
    errorCount++
  }

  const expenses = parseNamedAmounts(state.expenses, 'name', {
    maxLength: MAX_EXPENSE_NAME_LENGTH, tooLong: MESSAGES.expenseNameTooLong, required: MESSAGES.expenseNameRequired,
  })
  values.expenses = expenses.values
  errors.expenses = expenses.errors
  errorCount += expenses.errorCount

  // Disabled family gifts are hidden and not counted, so they can never block the summary.
  values.familyGiftsEnabled = state.familyGifts.enabled
  let familyTotal = 0
  if (state.familyGifts.enabled) {
    const family = parseNamedAmounts(state.familyGifts.items, 'label', {
      maxLength: MAX_FAMILY_LABEL_LENGTH, tooLong: MESSAGES.familyLabelTooLong, required: MESSAGES.familyLabelRequired,
    })
    values.familyGifts = family.values
    errors.family = family.errors
    errorCount += family.errorCount
    familyTotal = family.total
  } else {
    values.familyGifts = []
  }

  const eventValid = Object.keys(errors.event).length === 0
  const eventResult = eventValid ? calculateBudget({ ...values, expenses: [], familyGifts: [] }) : null
  const partials = { eventResult, venueCost: eventResult?.venueCost ?? null, expensesTotal: expenses.total, familyTotal }

  if (errorCount > 0) return { values: null, errors, errorCount, isEmpty: false, ...partials }

  const r = calculateBudget(values)
  const isEmpty = values.invitedGuests === 0 && r.attendingGuests === 0 && r.totalCost === 0 && r.totalIncome === 0
  return { values, errors, errorCount, isEmpty, ...partials }
}
