/**
 * Pure wedding-budget calculations. No React, no DOM, no I/O.
 *
 * PRECONDITION: every numeric input is an already-validated, non-negative
 * integer (whole shekels / whole guests / whole percent). Validation lives in
 * `validation.js`; this module never guesses or repairs input.
 *
 * Rounding rules (documented in the architecture, enforced by tests):
 *  R1  baseGuests = round(invited × rate / 100), half rounds up.
 *  R3  scenario-adjusted prices/gifts round to whole shekels (half up).
 *  R4  all sums/products are exact integers — no intermediate rounding.
 *  R6  breakEvenGift: the MINIMUM whole-shekel average gift that yields balance ≥ 0.
 *  R7  breakEvenMealPrice: the MAXIMUM whole-shekel regular meal price that keeps balance ≥ 0.
 *
 * Floating point: products are always computed before dividing
 * (`a * b / 100`, never `a * (b / 100)`), so halves such as 1.5 are exact before rounding.
 *
 * ── Reserve guests (assumptions) ──────────────────────────────────────────────
 * `reserveAvailable` reserve places are kept by the venue. `reserveGuests` of them
 * are expected to come IN ADDITION to the attendance estimate (validation keeps
 * reserveGuests ≤ reserveAvailable). They add to attendance and to gift income.
 *
 *  'as-needed'  The venue bills only meals actually needed. Reserve guests first
 *               fill guaranteed (minimum) meals that are paid but unused; only the
 *               rest is billed, at the reserve meal price.
 *  'prepaid'    Every reserve place is paid once in advance, used or not. Reserve
 *               guests eat those meals and never trigger a second charge.
 *
 * `reserveMealPrice` / `reserveGift` = null means "same as the regular meal price /
 * the average gift".
 *
 * ── Family gifts ──────────────────────────────────────────────────────────────
 * Fixed income on top of guest gifts (when enabled). They must NOT be part of the
 * average guest gift; the UI says so. Scenario sliders do not change them.
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
 * @property {number} attendanceRate      Percent, 0–100.
 * @property {number} mealPrice           Regular meal price (₪, VAT inclusive).
 * @property {number} minimumMeals        Guaranteed minimum regular meals (0 = none).
 * @property {number} averageGift         Average gift per attending guest (₪).
 * @property {'as-needed'|'prepaid'} reserveModel
 * @property {number} reserveAvailable    Reserve places kept by the venue.
 * @property {number} reserveGuests       Extra guests expected to come (≤ reserveAvailable).
 * @property {number|null} reserveMealPrice  null = same as mealPrice.
 * @property {number|null} reserveGift       null = same as averageGift.
 * @property {boolean} familyGiftsEnabled
 * @property {{id: string, label: string, amount: number}[]} familyGifts
 * @property {Expense[]} expenses         Additional (non-venue) expenses.
 */

/**
 * @typedef {{status: 'ok', value: number}
 *   | {status: 'impossible', shortfall: number}
 *   | {status: 'not-applicable'}} BreakEvenMealPrice
 */

/**
 * Expected attending guests from the invitation list (R1).
 * @param {number} invitedGuests
 * @param {number} attendanceRate Percent.
 */
export function calculateAttendingGuests(invitedGuests, attendanceRate) {
  return Math.round((invitedGuests * attendanceRate) / 100)
}

/**
 * Venue billing: guaranteed minimum, reserve model and where reserve guests sit.
 * @param {BudgetValues} v
 * @param {number} baseGuests
 */
function calculateVenue(v, baseGuests) {
  const mainMeals = Math.max(baseGuests, v.minimumMeals)
  const spareGuaranteed = mainMeals - baseGuests
  const prepaid = v.reserveModel === 'prepaid'

  // Prepaid reserve meals are used first (validation guarantees they suffice);
  // the defensive remainder follows the "as needed" rules.
  const fromPrepaid = prepaid ? Math.min(v.reserveGuests, v.reserveAvailable) : 0
  const remaining = v.reserveGuests - fromPrepaid
  const coveredByGuaranteed = Math.min(remaining, spareGuaranteed)
  const chargedExtra = remaining - coveredByGuaranteed
  const reserveMealsBilled = (prepaid ? v.reserveAvailable : 0) + chargedExtra

  const reserveMealPrice = v.reserveMealPrice ?? v.mealPrice
  const mealsCost = mainMeals * v.mealPrice
  const reserveCost = reserveMealsBilled * reserveMealPrice
  return {
    mainMeals,
    reserveMealsBilled,
    reserveMealPrice,
    coveredByGuaranteed,
    unusedMeals: spareGuaranteed - coveredByGuaranteed,
    unusedReserveMeals: prepaid ? v.reserveAvailable - fromPrepaid : 0,
    mealsCost,
    reserveCost,
    venueCost: mealsCost + reserveCost,
  }
}

/**
 * The highest whole-shekel regular meal price that still breaks even (R7),
 * holding everything else fixed.
 *
 * @param {{ income: number, fixedCosts: number, mealUnits: number }} parts
 *   income: all expected income; fixedCosts: costs that do not depend on the regular
 *   meal price; mealUnits: meals billed at the regular meal price.
 * @returns {BreakEvenMealPrice}
 */
export function calculateBreakEvenMealPrice({ income, fixedCosts, mealUnits }) {
  if (mealUnits === 0) return { status: 'not-applicable' }
  const available = income - fixedCosts
  if (available < 0) return { status: 'impossible', shortfall: -available }
  return { status: 'ok', value: Math.floor(available / mealUnits) }
}

/**
 * Full budget calculation.
 * @param {BudgetValues} v
 */
export function calculateBudget(v) {
  const baseGuests = calculateAttendingGuests(v.invitedGuests, v.attendanceRate)
  const reserveGuests = v.reserveGuests
  const attendingGuests = baseGuests + reserveGuests
  const venue = calculateVenue(v, baseGuests)

  const additionalCost = v.expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalCost = venue.venueCost + additionalCost

  const reserveGift = v.reserveGift ?? v.averageGift
  const guestGiftIncome = baseGuests * v.averageGift + reserveGuests * reserveGift
  const familyGiftIncome = v.familyGiftsEnabled ? v.familyGifts.reduce((sum, g) => sum + g.amount, 0) : 0
  const totalIncome = guestGiftIncome + familyGiftIncome
  const balance = totalIncome - totalCost

  // R6 — solve for the AVERAGE GIFT input. Reserve guests give the same gift unless
  // their gift is overridden, in which case their gifts are a fixed amount.
  const followsAverage = v.reserveGift === null
  const payingGuests = followsAverage ? attendingGuests : baseGuests
  const stillNeeded = totalCost - familyGiftIncome - (followsAverage ? 0 : reserveGuests * reserveGift)
  const breakEvenGift = attendingGuests === 0 || payingGuests === 0 ? null : Math.max(0, Math.ceil(stillNeeded / payingGuests))

  // R7 — solve for the regular meal price; reserve meals follow it unless overridden.
  const reserveFollowsMeal = v.reserveMealPrice === null
  const breakEvenMealPrice = calculateBreakEvenMealPrice({
    income: totalIncome,
    fixedCosts: additionalCost + (reserveFollowsMeal ? 0 : venue.reserveCost),
    mealUnits: venue.mainMeals + (reserveFollowsMeal ? venue.reserveMealsBilled : 0),
  })

  return {
    baseGuests,
    reserveGuests,
    attendingGuests,
    ...venue,
    additionalCost,
    totalCost,
    reserveGift,
    guestGiftIncome,
    familyGiftIncome,
    totalIncome,
    balance,
    balanceStatus: balance > 0 ? 'profit' : balance < 0 ? 'loss' : 'even',
    costPerAttendee: attendingGuests > 0 ? totalCost / attendingGuests : null,
    breakEvenGift,
    breakEvenMealPrice,
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

/** Adjusts an optional override; null ("same as …") stays null and follows its base. */
const adjustOptional = (amount, changePct) => (amount === null ? null : adjustByPercent(amount, changePct))

/**
 * @typedef {Object} ScenarioAdjustments
 * @property {number} mealPriceChangePct  Applied to the regular AND the reserve meal price.
 * @property {number} attendanceRate      Replaces the base attendance rate (percent).
 * @property {number} giftChangePct       Applied to the average gift and the reserve-guest gift.
 */

/**
 * Returns a NEW values object for a what-if scenario. The input is not mutated.
 * Reserve guests and family gifts are not changed by scenarios.
 *
 * @param {BudgetValues} values
 * @param {ScenarioAdjustments} adjustments
 * @returns {BudgetValues}
 */
export function applyScenario(values, { mealPriceChangePct, attendanceRate, giftChangePct }) {
  return {
    ...values,
    mealPrice: adjustByPercent(values.mealPrice, mealPriceChangePct),
    reserveMealPrice: adjustOptional(values.reserveMealPrice, mealPriceChangePct),
    attendanceRate,
    averageGift: adjustByPercent(values.averageGift, giftChangePct),
    reserveGift: adjustOptional(values.reserveGift, giftChangePct),
  }
}
