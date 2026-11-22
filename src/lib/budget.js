/**
 * Pure wedding-budget calculations. No React, no DOM, no I/O.
 *
 * PRECONDITION: every numeric input is an already-validated, non-negative
 * integer (whole shekels / whole guests / whole percent). Validation lives in
 * `validation.js`; this module never guesses or repairs input.
 *
 * Rounding rules (documented in the architecture, enforced by tests):
 *  R1  attendingGuests = round(invited × rate / 100), half rounds up.
 *  R3  scenario-adjusted prices/gifts round to whole shekels (half up).
 *  R4  all sums/products are exact integers — no intermediate rounding.
 *  R6  breakEvenGift = ceil(totalCost / attending): the MINIMUM whole-shekel
 *      average gift that yields balance ≥ 0.
 *  R7  breakEvenMealPrice = floor(available / mainMeals): the MAXIMUM
 *      whole-shekel regular meal price that keeps balance ≥ 0.
 *
 * Floating point: products are always computed before dividing
 * (`a * b / 100`, never `a * (b / 100)`), so the numerator is an exact integer
 * and halves such as 1.5 are represented exactly before rounding.
 */

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} name
 * @property {number} amount   Whole shekels, ≥ 0.
 */

/**
 * @typedef {Object} BudgetValues
 * @property {number} invitedGuests
 * @property {number} attendanceRate     Percent, 0–100.
 * @property {number} mealPrice          Regular meal price (₪, VAT inclusive).
 * @property {number} minimumMeals       Guaranteed minimum regular meals (0 = none).
 * @property {number} reserveMeals       Additional reserve meals expected to be billed.
 * @property {number} reserveMealPrice   Price per billed reserve meal (₪).
 * @property {number} averageGift        Average gift per ATTENDING guest (₪).
 * @property {Expense[]} expenses        Additional (non-venue) expenses.
 */

/**
 * @typedef {{status: 'ok', value: number}
 *   | {status: 'impossible', shortfall: number}
 *   | {status: 'not-applicable'}} BreakEvenMealPrice
 */

/**
 * @typedef {Object} BudgetResult
 * @property {number} attendingGuests
 * @property {number} mainMeals         Regular meals billed: max(attending, minimum).
 * @property {number} unusedMeals       Paid regular meals no guest will eat (minimum effect).
 * @property {number} mealsCost
 * @property {number} reserveCost
 * @property {number} venueCost         mealsCost + reserveCost.
 * @property {number} additionalCost    Sum of all additional expenses.
 * @property {number} totalCost
 * @property {number} giftIncome
 * @property {number} balance           giftIncome − totalCost (positive = profit).
 * @property {'profit'|'loss'|'even'} balanceStatus
 * @property {number|null} costPerAttendee   Exact totalCost / attending (unrounded); null when nobody attends.
 * @property {number|null} breakEvenGift     ceil(totalCost / attending); null when nobody attends.
 * @property {BreakEvenMealPrice} breakEvenMealPrice
 */

/**
 * Expected attending guests (R1).
 * @param {number} invitedGuests
 * @param {number} attendanceRate Percent.
 * @returns {number}
 */
export function calculateAttendingGuests(invitedGuests, attendanceRate) {
  return Math.round((invitedGuests * attendanceRate) / 100)
}

/**
 * Venue billing.
 *
 * Regular meals are billed for every attending guest, but never fewer than the
 * guaranteed minimum. Reserve meals are ADDITIONAL meals the couple expects the
 * venue to bill beyond the regular/guaranteed meals; they are added exactly
 * once and never count toward attendance, the minimum, or gift income.
 *
 * @param {BudgetValues} values
 * @param {number} attendingGuests
 */
function calculateVenue(values, attendingGuests) {
  const mainMeals = Math.max(attendingGuests, values.minimumMeals)
  const mealsCost = mainMeals * values.mealPrice
  const reserveCost = values.reserveMeals * values.reserveMealPrice
  return {
    mainMeals,
    unusedMeals: mainMeals - attendingGuests,
    mealsCost,
    reserveCost,
    venueCost: mealsCost + reserveCost,
  }
}

/**
 * The highest whole-shekel regular meal price that still breaks even (R7).
 * Reserve meal price is held fixed; only the regular meal price is solved for.
 *
 * @param {{giftIncome: number, additionalCost: number, reserveCost: number, mainMeals: number}} parts
 * @returns {BreakEvenMealPrice}
 */
export function calculateBreakEvenMealPrice({ giftIncome, additionalCost, reserveCost, mainMeals }) {
  if (mainMeals === 0) return { status: 'not-applicable' }
  const available = giftIncome - additionalCost - reserveCost
  if (available < 0) return { status: 'impossible', shortfall: -available }
  return { status: 'ok', value: Math.floor(available / mainMeals) }
}

/**
 * Full budget calculation.
 * @param {BudgetValues} values
 * @returns {BudgetResult}
 */
export function calculateBudget(values) {
  const attendingGuests = calculateAttendingGuests(values.invitedGuests, values.attendanceRate)
  const venue = calculateVenue(values, attendingGuests)
  const additionalCost = values.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalCost = venue.venueCost + additionalCost
  const giftIncome = attendingGuests * values.averageGift
  const balance = giftIncome - totalCost

  return {
    attendingGuests,
    ...venue,
    additionalCost,
    totalCost,
    giftIncome,
    balance,
    balanceStatus: balance > 0 ? 'profit' : balance < 0 ? 'loss' : 'even',
    costPerAttendee: attendingGuests > 0 ? totalCost / attendingGuests : null,
    breakEvenGift: attendingGuests > 0 ? Math.ceil(totalCost / attendingGuests) : null,
    breakEvenMealPrice: calculateBreakEvenMealPrice({
      giftIncome,
      additionalCost,
      reserveCost: venue.reserveCost,
      mainMeals: venue.mainMeals,
    }),
  }
}

/**
 * Applies a percentage change to a whole-shekel amount, rounding half up (R3).
 * Multiplies before dividing so the intermediate value is an exact integer.
 * @param {number} amount
 * @param {number} changePct  e.g. 10 for +10%, -5 for −5%.
 */
function adjustByPercent(amount, changePct) {
  return Math.round((amount * (100 + changePct)) / 100)
}

/**
 * @typedef {Object} ScenarioAdjustments
 * @property {number} mealPriceChangePct  Applied to BOTH regular and reserve meal prices.
 * @property {number} attendanceRate      Replaces the base attendance rate (percent).
 * @property {number} giftChangePct       Applied to the average gift.
 */

/**
 * Returns a NEW values object for a what-if scenario. The input is not mutated.
 *
 * The meal price change applies consistently to both the regular meal price and
 * the reserve meal price, on the assumption that a venue price change affects both.
 *
 * @param {BudgetValues} values
 * @param {ScenarioAdjustments} adjustments
 * @returns {BudgetValues}
 */
export function applyScenario(values, { mealPriceChangePct, attendanceRate, giftChangePct }) {
  return {
    ...values,
    mealPrice: adjustByPercent(values.mealPrice, mealPriceChangePct),
    reserveMealPrice: adjustByPercent(values.reserveMealPrice, mealPriceChangePct),
    attendanceRate,
    averageGift: adjustByPercent(values.averageGift, giftChangePct),
  }
}
