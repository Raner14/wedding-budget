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

export const MESSAGES = {
  notWhole: 'יש להזין מספר שלם, למשל 15,000',
  maxCount: 'המספר המקסימלי הוא 5,000',
  maxMoney: 'הסכום המקסימלי הוא ₪10,000,000',
  rateRange: 'אחוז ההגעה צריך להיות בין 0 ל-100',
  reservePriceRequired: 'יש להזין מחיר למנת רזרבה',
  expenseNameRequired: 'יש להזין שם להוצאה',
  expenseNameTooLong: `שם ההוצאה יכול להכיל עד ${MAX_EXPENSE_NAME_LENGTH} תווים`,
}

/** Field rules for the event details, keyed by state/value field name. */
export const EVENT_FIELD_RULES = {
  invitedGuests: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  attendanceRate: { max: 100, maxMessage: MESSAGES.rateRange },
  mealPrice: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney },
  minimumMeals: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  reserveMeals: { max: MAX_COUNT, maxMessage: MESSAGES.maxCount },
  reserveMealPrice: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney },
  averageGift: { max: MAX_MONEY, maxMessage: MESSAGES.maxMoney },
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

/**
 * @typedef {Object} ParsedBudget
 * @property {import('./budget.js').BudgetValues | null} values  Null when any field is invalid.
 * @property {{ event: Record<string, string>, expenses: Record<string, {name?: string, amount?: string}> }} errors
 * @property {number} errorCount
 * @property {boolean} isEmpty  True when there is nothing to calculate yet (no guests and no costs).
 * @property {number | null} venueCost     Available as soon as the event fields are valid (independent of expense errors).
 * @property {number | null} expensesTotal Sum of additional expenses; null while any expense amount is invalid.
 */

/**
 * @param {{ event: Record<string, string>, expenses: {id: string, name: string, amount: string}[] }} state
 * @returns {ParsedBudget}
 */
export function parseBudget(state) {
  const errors = { event: {}, expenses: {} }
  let errorCount = 0
  const values = {}

  for (const field of EVENT_FIELDS) {
    const rule = EVENT_FIELD_RULES[field]
    const parsed = parseWhole(state.event[field])
    if ('error' in parsed) {
      errors.event[field] = parsed.error
      errorCount++
    } else if (parsed.value > rule.max) {
      errors.event[field] = rule.maxMessage
      errorCount++
    } else {
      values[field] = parsed.value
    }
  }

  const reserveFieldsValid = !errors.event.reserveMeals && !errors.event.reserveMealPrice
  if (reserveFieldsValid && values.reserveMeals > 0 && values.reserveMealPrice === 0) {
    errors.event.reserveMealPrice = MESSAGES.reservePriceRequired
    errorCount++
  }

  values.expenses = state.expenses.map((expense) => {
    const fieldErrors = {}
    const parsed = parseWhole(expense.amount)
    let amount = 0
    if ('error' in parsed) fieldErrors.amount = parsed.error
    else if (parsed.value > MAX_MONEY) fieldErrors.amount = MESSAGES.maxMoney
    else amount = parsed.value

    const name = expense.name.trim()
    if (name.length > MAX_EXPENSE_NAME_LENGTH) fieldErrors.name = MESSAGES.expenseNameTooLong
    // A name is required only once the expense has a cost, so a freshly added
    // empty row does not immediately mark the whole summary as outdated.
    else if (name === '' && amount > 0) fieldErrors.name = MESSAGES.expenseNameRequired

    const count = Object.keys(fieldErrors).length
    if (count > 0) {
      errors.expenses[expense.id] = fieldErrors
      errorCount += count
    }
    return { id: expense.id, name: expense.name, amount }
  })

  const eventValid = Object.keys(errors.event).length === 0
  const venueCost = eventValid ? calculateBudget({ ...values, expenses: [] }).venueCost : null
  const amountsValid = Object.values(errors.expenses).every((e) => !e.amount)
  const expensesTotal = amountsValid ? values.expenses.reduce((sum, e) => sum + e.amount, 0) : null

  if (errorCount > 0) return { values: null, errors, errorCount, isEmpty: false, venueCost, expensesTotal }

  const { totalCost } = calculateBudget(values)
  return { values, errors, errorCount, isEmpty: values.invitedGuests === 0 && totalCost === 0, venueCost, expensesTotal }
}
