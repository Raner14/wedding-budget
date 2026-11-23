// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyScenario,
  calculateAttendingGuests,
  calculateBreakEvenMealPrice,
  calculateBudget,
} from './budget.js'

/** Builds valid BudgetValues with all optional features off. */
function makeValues(overrides = {}) {
  return {
    invitedGuests: 0,
    attendanceRate: 0,
    mealPrice: 0,
    minimumMeals: 0,
    averageGift: 0,
    reserveModel: 'as-needed',
    reserveAvailable: 0,
    reserveGuests: 0,
    reserveMealPrice: null,
    reserveGift: null,
    familyGiftsEnabled: false,
    familyGifts: [],
    expenses: [],
    ...overrides,
  }
}

const expenses = (...amounts) => amounts.map((amount, i) => ({ id: `e${i}`, name: `expense ${i}`, amount }))
const family = (...amounts) => amounts.map((amount, i) => ({ id: `f${i}`, label: `family ${i}`, amount }))

function deepFreeze(obj) {
  Object.values(obj).forEach((v) => v && typeof v === 'object' && deepFreeze(v))
  return Object.freeze(obj)
}

// The approved prototype's samples. LOSS_SAMPLE is the migrated form of the old
// "10 reserve meals × ₪200" input: prepaid reserve, no extra guests.
const PROFIT_SAMPLE = makeValues({
  invitedGuests: 300, attendanceRate: 85, mealPrice: 350, minimumMeals: 250,
  averageGift: 505, expenses: expenses(6000, 9000, 8000, 7000),
})
const LOSS_SAMPLE = makeValues({
  invitedGuests: 300, attendanceRate: 70, mealPrice: 380, minimumMeals: 250,
  reserveModel: 'prepaid', reserveAvailable: 10, reserveMealPrice: 200,
  averageGift: 450, expenses: expenses(6000, 9000, 8000, 7000),
})

describe('calculateBudget — regression against the approved samples (features off)', () => {
  it('profit sample', () => {
    const r = calculateBudget(PROFIT_SAMPLE)
    expect(r).toMatchObject({
      baseGuests: 255, reserveGuests: 0, attendingGuests: 255,
      mainMeals: 255, unusedMeals: 0, mealsCost: 89_250, reserveCost: 0, venueCost: 89_250,
      additionalCost: 30_000, totalCost: 119_250,
      guestGiftIncome: 128_775, familyGiftIncome: 0, totalIncome: 128_775,
      balance: 9_525, balanceStatus: 'profit',
      breakEvenGift: 468,
      breakEvenMealPrice: { status: 'ok', value: 387 },
    })
    expect(r.costPerAttendee).toBeCloseTo(119_250 / 255, 10)
  })

  it('loss sample with guaranteed minimum and prepaid reserve meals (old reserve input)', () => {
    const r = calculateBudget(LOSS_SAMPLE)
    expect(r).toMatchObject({
      baseGuests: 210, attendingGuests: 210, mainMeals: 250, unusedMeals: 40,
      reserveMealsBilled: 10, unusedReserveMeals: 10,
      mealsCost: 95_000, reserveCost: 2_000, venueCost: 97_000,
      totalCost: 127_000, totalIncome: 94_500,
      balance: -32_500, balanceStatus: 'loss',
      breakEvenGift: 605,
      breakEvenMealPrice: { status: 'ok', value: 250 },
    })
  })
})

describe('minimum guaranteed meals', () => {
  it('bills the minimum when fewer guests attend, and reports unused meals', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 100, attendanceRate: 80, mealPrice: 300, minimumMeals: 120 }))
    expect(r).toMatchObject({ baseGuests: 80, mainMeals: 120, unusedMeals: 40, mealsCost: 36_000 })
  })

  it('bills attending guests when they exceed the minimum', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 200, attendanceRate: 90, mealPrice: 300, minimumMeals: 150 }))
    expect(r).toMatchObject({ mainMeals: 180, unusedMeals: 0, mealsCost: 54_000 })
  })

  it('treats a minimum of 0 as "no minimum"', () => {
    expect(calculateBudget(makeValues({ invitedGuests: 50, attendanceRate: 100, mealPrice: 200 })).mainMeals).toBe(50)
  })
})

describe('reserve guests — model A: pay only for meals actually needed', () => {
  // 100 guests expected, minimum 120 → 20 guaranteed meals are paid but unused.
  const base = makeValues({
    invitedGuests: 100, attendanceRate: 100, mealPrice: 300, minimumMeals: 120, averageGift: 400,
    reserveModel: 'as-needed', reserveAvailable: 40,
  })

  it('reserve guests use unused guaranteed meals first — no extra charge', () => {
    const r = calculateBudget({ ...base, reserveGuests: 15 })
    expect(r).toMatchObject({
      baseGuests: 100, reserveGuests: 15, attendingGuests: 115,
      mainMeals: 120, coveredByGuaranteed: 15, reserveMealsBilled: 0, unusedMeals: 5,
      reserveCost: 0, venueCost: 36_000,
      guestGiftIncome: 115 * 400,
    })
  })

  it('only meals beyond the paid commitment are charged, at the reserve meal price', () => {
    const r = calculateBudget({ ...base, reserveGuests: 30, reserveMealPrice: 250 })
    expect(r).toMatchObject({
      attendingGuests: 130, coveredByGuaranteed: 20, reserveMealsBilled: 10, unusedMeals: 0,
      reserveCost: 2_500, venueCost: 36_000 + 2_500,
    })
  })

  it('charges every reserve guest when there is no spare guaranteed meal', () => {
    const r = calculateBudget({ ...base, minimumMeals: 0, reserveGuests: 10 })
    expect(r).toMatchObject({ mainMeals: 100, reserveMealsBilled: 10, reserveCost: 3_000 })
  })

  it('an empty reserve price follows the regular meal price', () => {
    const r = calculateBudget({ ...base, minimumMeals: 0, reserveGuests: 10, reserveMealPrice: null })
    expect(r.reserveMealPrice).toBe(300)
    expect(r.reserveCost).toBe(3_000)
  })

  it('costs nothing when no reserve guests are expected, however many places exist', () => {
    const r = calculateBudget({ ...base, reserveGuests: 0, reserveAvailable: 500 })
    expect(r.reserveCost).toBe(0)
    expect(r.unusedReserveMeals).toBe(0)
  })
})

describe('reserve guests — model B: prepaid reserve meals', () => {
  const base = makeValues({
    invitedGuests: 100, attendanceRate: 100, mealPrice: 300, minimumMeals: 0, averageGift: 400,
    reserveModel: 'prepaid', reserveAvailable: 20, reserveMealPrice: 250,
  })

  it('charges all prepaid reserve meals once, even when unused', () => {
    const r = calculateBudget({ ...base, reserveGuests: 0 })
    expect(r).toMatchObject({ reserveMealsBilled: 20, reserveCost: 5_000, unusedReserveMeals: 20, attendingGuests: 100 })
  })

  it('reserve guests use the prepaid meals without a second charge', () => {
    const r = calculateBudget({ ...base, reserveGuests: 12 })
    expect(r).toMatchObject({
      attendingGuests: 112, reserveMealsBilled: 20, reserveCost: 5_000, unusedReserveMeals: 8,
      guestGiftIncome: 112 * 400,
    })
  })

  it('never double-counts with a guaranteed minimum', () => {
    const r = calculateBudget({ ...base, minimumMeals: 110, reserveGuests: 12 })
    // 110 guaranteed (10 unused by base guests) + 20 prepaid; reserve guests sit in prepaid meals.
    expect(r).toMatchObject({ mainMeals: 110, unusedMeals: 10, reserveMealsBilled: 20, unusedReserveMeals: 8 })
    expect(r.venueCost).toBe(110 * 300 + 20 * 250)
  })

  it('defensively bills reserve guests beyond the prepaid places as needed', () => {
    const r = calculateBudget({ ...base, minimumMeals: 105, reserveGuests: 30 }) // 10 more than prepaid
    expect(r).toMatchObject({ reserveMealsBilled: 25, coveredByGuaranteed: 5, unusedReserveMeals: 0 })
  })
})

describe('reserve guest gifts', () => {
  const base = makeValues({ invitedGuests: 100, attendanceRate: 100, averageGift: 400, reserveAvailable: 20, reserveGuests: 10 })

  it('default to the average gift', () => {
    const r = calculateBudget(base)
    expect(r.reserveGift).toBe(400)
    expect(r.guestGiftIncome).toBe(110 * 400)
  })

  it('can be overridden', () => {
    const r = calculateBudget({ ...base, reserveGift: 300 })
    expect(r.guestGiftIncome).toBe(100 * 400 + 10 * 300)
  })
})

describe('family gifts', () => {
  const base = makeValues({ ...PROFIT_SAMPLE, familyGifts: family(20_000, 5_000) })

  it('are ignored while disabled', () => {
    const r = calculateBudget(base)
    expect(r.familyGiftIncome).toBe(0)
    expect(r.balance).toBe(9_525)
  })

  it('add fixed income when enabled', () => {
    const r = calculateBudget({ ...base, familyGiftsEnabled: true })
    expect(r).toMatchObject({ guestGiftIncome: 128_775, familyGiftIncome: 25_000, totalIncome: 153_775, balance: 34_525 })
  })

  it('lower the break-even gift and raise the break-even meal price', () => {
    const r = calculateBudget({ ...base, familyGiftsEnabled: true })
    expect(r.breakEvenGift).toBe(Math.ceil((119_250 - 25_000) / 255)) // 370
    expect(r.breakEvenMealPrice).toEqual({ status: 'ok', value: Math.floor((153_775 - 30_000) / 255) }) // 485
  })

  it('can cover everything: the break-even gift never goes below 0', () => {
    const r = calculateBudget({ ...base, familyGiftsEnabled: true, familyGifts: family(200_000) })
    expect(r.breakEvenGift).toBe(0)
  })

  it('make a profit possible with no guests at all', () => {
    const r = calculateBudget(makeValues({ familyGiftsEnabled: true, familyGifts: family(10_000), expenses: expenses(4_000) }))
    expect(r).toMatchObject({ attendingGuests: 0, totalIncome: 10_000, balance: 6_000, balanceStatus: 'profit', breakEvenGift: null })
  })
})

describe('break-even gift with reserve guests', () => {
  const base = makeValues({
    invitedGuests: 100, attendanceRate: 100, mealPrice: 300, averageGift: 350,
    reserveAvailable: 20, reserveGuests: 20, expenses: expenses(6_000),
  })

  it('spreads over all attending guests when reserve gifts follow the average', () => {
    const r = calculateBudget(base) // cost 120×300 + 6,000 = 42,000 over 120 guests
    expect(r.breakEvenGift).toBe(350)
  })

  it('treats an overridden reserve gift as fixed income', () => {
    const r = calculateBudget({ ...base, reserveGift: 200 }) // (42,000 − 20×200) / 100
    expect(r.breakEvenGift).toBe(380)
  })
})

describe('zero attending guests', () => {
  it('reports the full expenses as a loss and returns null per-guest metrics', () => {
    const r = calculateBudget(makeValues({
      attendanceRate: 85, mealPrice: 350, minimumMeals: 250, averageGift: 450, expenses: expenses(6000, 9000, 8000, 7000),
    }))
    expect(r).toMatchObject({ attendingGuests: 0, totalIncome: 0, venueCost: 87_500, totalCost: 117_500, balance: -117_500, balanceStatus: 'loss' })
    expect(r.costPerAttendee).toBeNull()
    expect(r.breakEvenGift).toBeNull()
    expect(r.breakEvenMealPrice).toEqual({ status: 'impossible', shortfall: 30_000 })
  })

  it('returns not-applicable meal break-even when no meals are billed', () => {
    expect(calculateBudget(makeValues({ mealPrice: 350, expenses: expenses(5000) })).breakEvenMealPrice).toEqual({ status: 'not-applicable' })
  })

  it('is "even" when nothing is entered', () => {
    expect(calculateBudget(makeValues())).toMatchObject({ balance: 0, balanceStatus: 'even' })
  })
})

describe('calculateAttendingGuests — R1 rounding', () => {
  it.each([
    [300, 85, 255], [3, 50, 2], [1, 50, 1], [7, 50, 4], [10, 33, 3], [10, 37, 4], [0, 85, 0], [5000, 100, 5000], [29, 55, 16],
  ])('%i invited × %i%% → %i', (invited, rate, expected) => {
    expect(calculateAttendingGuests(invited, rate)).toBe(expected)
  })

  it('multiplies before dividing, so exact halves never round down', () => {
    for (let invited = 1; invited <= 999; invited += 2) expect(calculateAttendingGuests(invited, 50)).toBe((invited + 1) / 2)
  })
})

describe('calculateBreakEvenMealPrice', () => {
  it('returns the floor of the available amount per meal', () => {
    expect(calculateBreakEvenMealPrice({ income: 1000, fixedCosts: 0, mealUnits: 3 })).toEqual({ status: 'ok', value: 333 })
  })
  it('returns 0 (not negative) when exactly nothing is left', () => {
    expect(calculateBreakEvenMealPrice({ income: 500, fixedCosts: 500, mealUnits: 10 })).toEqual({ status: 'ok', value: 0 })
  })
  it('reports the exact shortfall instead of a negative price', () => {
    expect(calculateBreakEvenMealPrice({ income: 10_000, fixedCosts: 16_000, mealUnits: 50 })).toEqual({ status: 'impossible', shortfall: 6_000 })
  })
  it('is not applicable without billed meals', () => {
    expect(calculateBreakEvenMealPrice({ income: 0, fixedCosts: 100, mealUnits: 0 })).toEqual({ status: 'not-applicable' })
  })
})

describe('properties over many deterministic random budgets (R6, R7, no double counting)', () => {
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const rand = mulberry32(20261123)
  const int = (max) => Math.floor(rand() * (max + 1))
  const maybe = (p, value) => (rand() < p ? value : null)

  const cases = Array.from({ length: 400 }, () => {
    const reserveAvailable = rand() < 0.5 ? 0 : int(40)
    return makeValues({
      invitedGuests: int(600),
      attendanceRate: int(100),
      mealPrice: int(600),
      minimumMeals: rand() < 0.5 ? 0 : int(400),
      averageGift: int(1000),
      reserveModel: rand() < 0.5 ? 'as-needed' : 'prepaid',
      reserveAvailable,
      reserveGuests: int(reserveAvailable),
      reserveMealPrice: maybe(0.5, int(600)),
      reserveGift: maybe(0.4, int(1000)),
      familyGiftsEnabled: rand() < 0.5,
      familyGifts: family(...Array.from({ length: int(3) }, () => int(30_000))),
      expenses: expenses(...Array.from({ length: int(5) }, () => int(20_000))),
    })
  })

  it('every attending guest has exactly one meal, and every billed meal is counted once', () => {
    for (const v of cases) {
      const r = calculateBudget(v)
      const paidMeals = r.mainMeals + r.reserveMealsBilled
      expect(paidMeals - r.unusedMeals - r.unusedReserveMeals).toBe(r.attendingGuests)
      expect(r.venueCost).toBe(r.mainMeals * v.mealPrice + r.reserveMealsBilled * (v.reserveMealPrice ?? v.mealPrice))
      expect(r.totalIncome).toBe(r.guestGiftIncome + r.familyGiftIncome)
    }
  })

  it('breakEvenGift is the minimum whole-shekel average gift that breaks even', () => {
    let checked = 0
    for (const v of cases) {
      const { breakEvenGift } = calculateBudget(v)
      if (breakEvenGift === null) continue
      checked++
      expect(calculateBudget({ ...v, averageGift: breakEvenGift }).balance).toBeGreaterThanOrEqual(0)
      if (breakEvenGift > 0) expect(calculateBudget({ ...v, averageGift: breakEvenGift - 1 }).balance).toBeLessThan(0)
    }
    expect(checked).toBeGreaterThan(250)
  })

  it('breakEvenMealPrice is the maximum whole-shekel regular meal price that breaks even', () => {
    const seen = { ok: 0, impossible: 0, 'not-applicable': 0 }
    for (const v of cases) {
      const { breakEvenMealPrice: be } = calculateBudget(v)
      seen[be.status]++
      if (be.status === 'ok') {
        expect(calculateBudget({ ...v, mealPrice: be.value }).balance).toBeGreaterThanOrEqual(0)
        expect(calculateBudget({ ...v, mealPrice: be.value + 1 }).balance).toBeLessThan(0)
      } else if (be.status === 'impossible') {
        expect(calculateBudget({ ...v, mealPrice: 0 }).balance).toBe(-be.shortfall)
      }
    }
    expect(seen.ok).toBeGreaterThan(50)
    expect(seen.impossible).toBeGreaterThan(20)
  })

  it('with every optional feature off, matches the original (pre-reserve-guests) formulas', () => {
    for (const v of cases) {
      const plain = { ...v, reserveAvailable: 0, reserveGuests: 0, familyGiftsEnabled: false }
      const r = calculateBudget(plain)
      const attending = calculateAttendingGuests(v.invitedGuests, v.attendanceRate)
      const cost = Math.max(attending, v.minimumMeals) * v.mealPrice + v.expenses.reduce((s, e) => s + e.amount, 0)
      expect(r.attendingGuests).toBe(attending)
      expect(r.totalCost).toBe(cost)
      expect(r.balance).toBe(attending * v.averageGift - cost)
      expect(r.breakEvenGift).toBe(attending > 0 ? Math.ceil(cost / attending) : null)
    }
  })
})

describe('applyScenario', () => {
  const neutral = { mealPriceChangePct: 0, attendanceRate: 70, giftChangePct: 0 }

  it('changes nothing with neutral adjustments', () => {
    expect(applyScenario(LOSS_SAMPLE, neutral)).toEqual(LOSS_SAMPLE)
  })

  it('applies the meal price change to the regular AND the reserve meal price', () => {
    const s = applyScenario(LOSS_SAMPLE, { ...neutral, mealPriceChangePct: 10 })
    expect(s.mealPrice).toBe(418)
    expect(s.reserveMealPrice).toBe(220)
    const r = calculateBudget(s)
    expect(r.mealsCost).toBe(250 * 418)
    expect(r.reserveCost).toBe(10 * 220)
  })

  it('keeps "same as …" overrides following their base value', () => {
    const v = makeValues({ mealPrice: 300, averageGift: 400, reserveMealPrice: null, reserveGift: null })
    const s = applyScenario(v, { mealPriceChangePct: 10, attendanceRate: 0, giftChangePct: -10 })
    expect(s).toMatchObject({ mealPrice: 330, reserveMealPrice: null, averageGift: 360, reserveGift: null })
  })

  it('applies the gift change to an overridden reserve-guest gift too', () => {
    const s = applyScenario(makeValues({ averageGift: 400, reserveGift: 300 }), { mealPriceChangePct: 0, attendanceRate: 0, giftChangePct: 20 })
    expect(s.reserveGift).toBe(360)
  })

  it('does not change reserve guests or family gifts', () => {
    const v = makeValues({ reserveAvailable: 10, reserveGuests: 5, familyGiftsEnabled: true, familyGifts: family(10_000) })
    const s = applyScenario(v, { mealPriceChangePct: 30, attendanceRate: 50, giftChangePct: -30 })
    expect(s.reserveGuests).toBe(5)
    expect(s.familyGifts).toEqual(v.familyGifts)
  })

  it('rounds adjusted amounts to whole shekels, half up (R3)', () => {
    const s = applyScenario(makeValues({ mealPrice: 10, reserveMealPrice: 30, averageGift: 50 }), { mealPriceChangePct: 5, attendanceRate: 0, giftChangePct: -5 })
    expect(s).toMatchObject({ mealPrice: 11, reserveMealPrice: 32, averageGift: 48 })
  })

  it('does not mutate its input', () => {
    const frozen = deepFreeze(structuredClone(LOSS_SAMPLE))
    expect(() => applyScenario(frozen, { mealPriceChangePct: 10, attendanceRate: 50, giftChangePct: 10 })).not.toThrow()
  })
})

describe('purity', () => {
  it('calculateBudget does not mutate its input and is deterministic', () => {
    const frozen = deepFreeze(structuredClone({ ...PROFIT_SAMPLE, familyGifts: family(1000), familyGiftsEnabled: true }))
    expect(calculateBudget(frozen)).toEqual(calculateBudget(frozen))
  })
})
