// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyScenario,
  calculateAttendingGuests,
  calculateBreakEvenMealPrice,
  calculateBudget,
} from './budget.js'

/** Builds a valid BudgetValues object with sensible zero defaults. */
function makeValues(overrides = {}) {
  return {
    invitedGuests: 0,
    attendanceRate: 0,
    mealPrice: 0,
    minimumMeals: 0,
    reserveMeals: 0,
    reserveMealPrice: 0,
    averageGift: 0,
    expenses: [],
    ...overrides,
  }
}

const expenses = (...amounts) => amounts.map((amount, i) => ({ id: `e${i}`, name: `expense ${i}`, amount }))

/** Recursively freezes an object so any mutation throws in strict mode. */
function deepFreeze(obj) {
  Object.values(obj).forEach((v) => v && typeof v === 'object' && deepFreeze(v))
  return Object.freeze(obj)
}

// The two sample scenarios from the approved design prototype.
const PROFIT_SAMPLE = makeValues({
  invitedGuests: 300, attendanceRate: 85, mealPrice: 350, minimumMeals: 250,
  averageGift: 505, expenses: expenses(6000, 9000, 8000, 7000),
})
const LOSS_SAMPLE = makeValues({
  invitedGuests: 300, attendanceRate: 70, mealPrice: 380, minimumMeals: 250,
  reserveMeals: 10, reserveMealPrice: 200, averageGift: 450, expenses: expenses(6000, 9000, 8000, 7000),
})

describe('calculateBudget — regression against the approved prototype samples', () => {
  it('profit sample', () => {
    const r = calculateBudget(PROFIT_SAMPLE)
    expect(r).toMatchObject({
      attendingGuests: 255,
      mainMeals: 255,
      unusedMeals: 0,
      mealsCost: 89_250,
      reserveCost: 0,
      venueCost: 89_250,
      additionalCost: 30_000,
      totalCost: 119_250,
      giftIncome: 128_775,
      balance: 9_525,
      balanceStatus: 'profit',
      breakEvenGift: 468,
      breakEvenMealPrice: { status: 'ok', value: 387 },
    })
    expect(r.costPerAttendee).toBeCloseTo(119_250 / 255, 10) // 467.647…
  })

  it('loss sample with guaranteed minimum and reserve meals', () => {
    const r = calculateBudget(LOSS_SAMPLE)
    expect(r).toMatchObject({
      attendingGuests: 210,
      mainMeals: 250,
      unusedMeals: 40,
      mealsCost: 95_000,
      reserveCost: 2_000,
      venueCost: 97_000,
      additionalCost: 30_000,
      totalCost: 127_000,
      giftIncome: 94_500,
      balance: -32_500,
      balanceStatus: 'loss',
      breakEvenGift: 605,
      breakEvenMealPrice: { status: 'ok', value: 250 },
    })
    expect(r.costPerAttendee).toBeCloseTo(127_000 / 210, 10) // 604.76…
  })
})

describe('minimum guaranteed meals', () => {
  it('bills the minimum when fewer guests attend, and reports unused meals', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 100, attendanceRate: 80, mealPrice: 300, minimumMeals: 120 }))
    expect(r.attendingGuests).toBe(80)
    expect(r.mainMeals).toBe(120)
    expect(r.unusedMeals).toBe(40)
    expect(r.mealsCost).toBe(36_000)
  })

  it('bills attending guests when they exceed the minimum', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 200, attendanceRate: 90, mealPrice: 300, minimumMeals: 150 }))
    expect(r.mainMeals).toBe(180)
    expect(r.unusedMeals).toBe(0)
    expect(r.mealsCost).toBe(54_000)
  })

  it('treats a minimum of 0 as "no minimum"', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 50, attendanceRate: 100, mealPrice: 200 }))
    expect(r.mainMeals).toBe(50)
    expect(r.unusedMeals).toBe(0)
  })

  it('bills exactly the minimum when attendance equals it', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 100, attendanceRate: 100, mealPrice: 10, minimumMeals: 100 }))
    expect(r.mainMeals).toBe(100)
    expect(r.unusedMeals).toBe(0)
  })
})

describe('reserve meals', () => {
  const base = makeValues({ invitedGuests: 100, attendanceRate: 100, mealPrice: 300, minimumMeals: 80, averageGift: 400 })

  it('adds reserve cost to the venue exactly once', () => {
    const without = calculateBudget(base)
    const withReserve = calculateBudget({ ...base, reserveMeals: 10, reserveMealPrice: 200 })
    expect(withReserve.reserveCost).toBe(2_000)
    expect(withReserve.venueCost).toBe(without.venueCost + 2_000)
    expect(withReserve.totalCost).toBe(without.totalCost + 2_000)
  })

  it('does not affect billed regular meals, attendance or gift income', () => {
    const without = calculateBudget(base)
    const withReserve = calculateBudget({ ...base, reserveMeals: 10, reserveMealPrice: 200 })
    expect(withReserve.mainMeals).toBe(without.mainMeals)
    expect(withReserve.unusedMeals).toBe(without.unusedMeals)
    expect(withReserve.attendingGuests).toBe(without.attendingGuests)
    expect(withReserve.giftIncome).toBe(without.giftIncome)
  })

  it('costs nothing when reserve meals are 0, regardless of the reserve price', () => {
    expect(calculateBudget({ ...base, reserveMeals: 0, reserveMealPrice: 999 }).reserveCost).toBe(0)
  })
})

describe('zero attending guests', () => {
  it('reports the full expenses as a loss and returns null per-guest metrics', () => {
    const r = calculateBudget(makeValues({
      invitedGuests: 0, attendanceRate: 85, mealPrice: 350, minimumMeals: 250, averageGift: 450,
      expenses: expenses(6000, 9000, 8000, 7000),
    }))
    expect(r.attendingGuests).toBe(0)
    expect(r.giftIncome).toBe(0)
    expect(r.venueCost).toBe(87_500) // the minimum is still billed
    expect(r.totalCost).toBe(117_500)
    expect(r.balance).toBe(-117_500)
    expect(r.balanceStatus).toBe('loss')
    expect(r.costPerAttendee).toBeNull()
    expect(r.breakEvenGift).toBeNull()
    expect(r.breakEvenMealPrice).toEqual({ status: 'impossible', shortfall: 30_000 })
  })

  it('returns not-applicable meal break-even when no regular meals are billed', () => {
    const r = calculateBudget(makeValues({ attendanceRate: 85, mealPrice: 350, expenses: expenses(5000) }))
    expect(r.mainMeals).toBe(0)
    expect(r.balance).toBe(-5_000)
    expect(r.breakEvenMealPrice).toEqual({ status: 'not-applicable' })
  })

  it('treats a 0% attendance rate like zero guests', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 300, attendanceRate: 0, averageGift: 500 }))
    expect(r.attendingGuests).toBe(0)
    expect(r.costPerAttendee).toBeNull()
    expect(r.breakEvenGift).toBeNull()
  })

  it('is "even" when nobody attends and nothing costs anything', () => {
    const r = calculateBudget(makeValues())
    expect(r.balance).toBe(0)
    expect(r.balanceStatus).toBe('even')
  })
})

describe('balance status', () => {
  it('is "even" when gifts exactly cover costs', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 100, attendanceRate: 100, mealPrice: 300, averageGift: 350, expenses: expenses(5000) }))
    expect(r.balance).toBe(0)
    expect(r.balanceStatus).toBe('even')
  })

  it('sums any number of expenses, and treats zero amounts as not applicable', () => {
    const r = calculateBudget(makeValues({ expenses: expenses(1500, 0, 2500, 0, 1) }))
    expect(r.additionalCost).toBe(4_001)
  })
})

describe('costPerAttendee and breakEvenGift', () => {
  it('keeps costPerAttendee exact and rounds breakEvenGift UP to a whole shekel (R6)', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 3, attendanceRate: 100, expenses: expenses(1000) }))
    expect(r.costPerAttendee).toBeCloseTo(333.333333, 5)
    expect(r.breakEvenGift).toBe(334)
  })

  it('agree exactly when the cost divides evenly', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 4, attendanceRate: 100, expenses: expenses(1000) }))
    expect(r.costPerAttendee).toBe(250)
    expect(r.breakEvenGift).toBe(250)
  })

  it('are 0 when there are guests but no costs', () => {
    const r = calculateBudget(makeValues({ invitedGuests: 10, attendanceRate: 100, averageGift: 300 }))
    expect(r.costPerAttendee).toBe(0)
    expect(r.breakEvenGift).toBe(0)
  })
})

describe('calculateAttendingGuests — R1 rounding', () => {
  it.each([
    [300, 85, 255],
    [3, 50, 2],   // 1.5 → 2 (half rounds up)
    [1, 50, 1],   // 0.5 → 1
    [7, 50, 4],   // 3.5 → 4
    [10, 33, 3],  // 3.3 → 3
    [10, 37, 4],  // 3.7 → 4
    [0, 85, 0],
    [250, 100, 250],
    [5000, 100, 5000],
    [29, 55, 16], // 15.95 → 16
  ])('%i invited × %i%% → %i', (invited, rate, expected) => {
    expect(calculateAttendingGuests(invited, rate)).toBe(expected)
  })

  it('multiplies before dividing, so exact halves never round down', () => {
    // Every odd number of guests at 50% lands exactly on .5 and must round up.
    for (let invited = 1; invited <= 999; invited += 2) {
      expect(calculateAttendingGuests(invited, 50)).toBe((invited + 1) / 2)
    }
  })
})

describe('calculateBreakEvenMealPrice', () => {
  it('returns the floor of the available amount per billed meal', () => {
    expect(calculateBreakEvenMealPrice({ giftIncome: 1000, additionalCost: 0, reserveCost: 0, mainMeals: 3 }))
      .toEqual({ status: 'ok', value: 333 })
  })

  it('returns 0 (not negative) when the remaining budget is exactly zero', () => {
    expect(calculateBreakEvenMealPrice({ giftIncome: 500, additionalCost: 300, reserveCost: 200, mainMeals: 10 }))
      .toEqual({ status: 'ok', value: 0 })
  })

  it('reports the exact shortfall instead of a negative price', () => {
    expect(calculateBreakEvenMealPrice({ giftIncome: 10_000, additionalCost: 15_000, reserveCost: 1_000, mainMeals: 50 }))
      .toEqual({ status: 'impossible', shortfall: 6_000 })
  })

  it('is not applicable without billed regular meals', () => {
    expect(calculateBreakEvenMealPrice({ giftIncome: 0, additionalCost: 100, reserveCost: 0, mainMeals: 0 }))
      .toEqual({ status: 'not-applicable' })
  })
})

describe('break-even properties over many deterministic random budgets (R6, R7)', () => {
  // Small seeded PRNG (mulberry32) so failures are reproducible.
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const rand = mulberry32(20261122)
  const int = (max) => Math.floor(rand() * (max + 1))

  const cases = Array.from({ length: 300 }, () => makeValues({
    invitedGuests: int(600),
    attendanceRate: int(100),
    mealPrice: int(600),
    minimumMeals: rand() < 0.5 ? 0 : int(400),
    reserveMeals: rand() < 0.6 ? 0 : int(20),
    reserveMealPrice: int(400),
    averageGift: int(1000),
    expenses: expenses(...Array.from({ length: int(5) }, () => int(20_000))),
  }))

  it('breakEvenGift is the minimum whole-shekel gift that breaks even', () => {
    let checked = 0
    for (const values of cases) {
      const { breakEvenGift, costPerAttendee } = calculateBudget(values)
      if (breakEvenGift === null) continue
      checked++
      expect(calculateBudget({ ...values, averageGift: breakEvenGift }).balance).toBeGreaterThanOrEqual(0)
      if (breakEvenGift > 0) {
        expect(calculateBudget({ ...values, averageGift: breakEvenGift - 1 }).balance).toBeLessThan(0)
      }
      expect(breakEvenGift - 1).toBeLessThan(costPerAttendee)
      expect(costPerAttendee).toBeLessThanOrEqual(breakEvenGift)
    }
    expect(checked).toBeGreaterThan(200)
  })

  it('breakEvenMealPrice is the maximum whole-shekel meal price that breaks even', () => {
    const seen = { ok: 0, impossible: 0, 'not-applicable': 0 }
    for (const values of cases) {
      const { breakEvenMealPrice: be, mainMeals } = calculateBudget(values)
      seen[be.status]++
      if (be.status === 'ok') {
        expect(calculateBudget({ ...values, mealPrice: be.value }).balance).toBeGreaterThanOrEqual(0)
        expect(calculateBudget({ ...values, mealPrice: be.value + 1 }).balance).toBeLessThan(0)
      } else if (be.status === 'impossible') {
        // Even with free regular meals the balance equals exactly −shortfall.
        expect(calculateBudget({ ...values, mealPrice: 0 }).balance).toBe(-be.shortfall)
        expect(be.shortfall).toBeGreaterThan(0)
      } else {
        expect(mainMeals).toBe(0)
      }
    }
    expect(seen.ok).toBeGreaterThan(50)
    expect(seen.impossible).toBeGreaterThan(20)
  })
})

describe('applyScenario', () => {
  const neutral = { mealPriceChangePct: 0, attendanceRate: 70, giftChangePct: 0 }

  it('changes nothing with neutral adjustments (other than the chosen rate)', () => {
    expect(applyScenario(LOSS_SAMPLE, neutral)).toEqual(LOSS_SAMPLE)
  })

  it('applies the meal price change to BOTH regular and reserve meal prices', () => {
    const s = applyScenario(LOSS_SAMPLE, { ...neutral, mealPriceChangePct: 10 })
    expect(s.mealPrice).toBe(418)        // 380 × 1.10
    expect(s.reserveMealPrice).toBe(220) // 200 × 1.10
    const down = applyScenario(LOSS_SAMPLE, { ...neutral, mealPriceChangePct: -30 })
    expect(down.mealPrice).toBe(266)        // 380 × 0.70
    expect(down.reserveMealPrice).toBe(140) // 200 × 0.70
  })

  it('reflects the reserve price change in the scenario venue cost', () => {
    const r = calculateBudget(applyScenario(LOSS_SAMPLE, { ...neutral, mealPriceChangePct: 10 }))
    expect(r.mealsCost).toBe(250 * 418)
    expect(r.reserveCost).toBe(10 * 220)
  })

  it('rounds adjusted amounts to whole shekels, half up (R3)', () => {
    const v = makeValues({ mealPrice: 10, reserveMealPrice: 30, averageGift: 50 })
    const s = applyScenario(v, { mealPriceChangePct: 5, attendanceRate: 0, giftChangePct: -5 })
    expect(s.mealPrice).toBe(11)        // 10.5 → 11
    expect(s.reserveMealPrice).toBe(32) // 31.5 → 32
    expect(s.averageGift).toBe(48)      // 47.5 → 48
  })

  it('avoids floating-point drift (350 + 10% is exactly 385)', () => {
    const s = applyScenario(PROFIT_SAMPLE, { ...neutral, mealPriceChangePct: 10, attendanceRate: 85 })
    expect(s.mealPrice).toBe(385)
    expect(Number.isInteger(s.mealPrice)).toBe(true)
  })

  it('replaces the attendance rate and adjusts the average gift', () => {
    const s = applyScenario(PROFIT_SAMPLE, { mealPriceChangePct: 0, attendanceRate: 60, giftChangePct: 20 })
    expect(s.attendanceRate).toBe(60)
    expect(s.averageGift).toBe(606) // 505 × 1.20
    expect(calculateBudget(s).attendingGuests).toBe(180)
  })

  it('leaves untouched fields and expenses as they were', () => {
    const s = applyScenario(LOSS_SAMPLE, { mealPriceChangePct: 20, attendanceRate: 90, giftChangePct: -10 })
    expect(s.invitedGuests).toBe(300)
    expect(s.minimumMeals).toBe(250)
    expect(s.reserveMeals).toBe(10)
    expect(s.expenses).toEqual(LOSS_SAMPLE.expenses)
  })

  it('does not mutate its input', () => {
    const frozen = deepFreeze(structuredClone(LOSS_SAMPLE))
    expect(() => applyScenario(frozen, { mealPriceChangePct: 10, attendanceRate: 50, giftChangePct: 10 })).not.toThrow()
    expect(frozen.mealPrice).toBe(380)
  })
})

describe('purity', () => {
  it('calculateBudget does not mutate its input and is deterministic', () => {
    const frozen = deepFreeze(structuredClone(PROFIT_SAMPLE))
    const a = calculateBudget(frozen)
    const b = calculateBudget(frozen)
    expect(a).toEqual(b)
  })
})
