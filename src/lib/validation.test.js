// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatWholeInput, MESSAGES, parseBudget, parseWhole } from './validation.js'

function makeState(event = {}, expenses = [], familyGifts = { enabled: false, items: [] }) {
  return {
    event: {
      invitedGuests: '', attendanceRate: '85', mealPrice: '', minimumMeals: '', averageGift: '',
      reserveAvailable: '', reserveGuests: '', reserveMealPrice: '', reserveGift: '',
      ...event,
    },
    expenses,
    familyGifts,
  }
}

describe('parseWhole', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['0', 0],
    ['350', 350],
    ['15,000', 15_000],
    ['1,234,567', 1_234_567],
    [' 42 ', 42],
    ['007', 7],
    ['2,500', 2_500],
    ['15 000', 15_000],
    ['1 234 567', 1_234_567],
  ])('%j → %i', (raw, expected) => {
    expect(parseWhole(raw)).toEqual({ value: expected })
  })

  it.each(['-5', '1.5', '12א', 'abc', '3e2', '+4', '٣', '9,000-'])('rejects %j', (raw) => {
    expect(parseWhole(raw)).toEqual({ error: MESSAGES.notWhole })
  })

  // Regression: separators used to be stripped anywhere, so "350,5" (a decimal comma)
  // silently became 3,505 — a ten-fold price error.
  it.each(['350,5', '1,5', '1,50', '12,34,56', '1,2345', '1 5', '1, 000', ',500', '500,'])(
    'rejects misplaced separators instead of guessing (%j)',
    (raw) => {
      expect(parseWhole(raw)).toEqual({ error: MESSAGES.notWhole })
    },
  )

  it('treats null/undefined as empty', () => {
    expect(parseWhole(undefined)).toEqual({ value: 0 })
    expect(parseWhole(null)).toEqual({ value: 0 })
  })
})

describe('parseBudget — event fields', () => {
  it('converts a valid state into numeric values', () => {
    const p = parseBudget(makeState(
      { invitedGuests: '300', mealPrice: '350', minimumMeals: '250', averageGift: '505' },
      [{ id: 'a', name: 'צלם', amount: '9,000' }],
    ))
    expect(p.errorCount).toBe(0)
    expect(p.values).toEqual({
      invitedGuests: 300, attendanceRate: 85, mealPrice: 350, minimumMeals: 250, averageGift: 505,
      reserveAvailable: 0, reserveGuests: 0, reserveMealPrice: null, reserveGift: null,
      familyGiftsEnabled: false, familyGifts: [],
      expenses: [{ id: 'a', name: 'צלם', amount: 9_000 }],
    })
    expect(p.isEmpty).toBe(false)
  })

  it('reports a field error and returns null values', () => {
    const p = parseBudget(makeState({ mealPrice: '35O' }))
    expect(p.values).toBeNull()
    expect(p.errorCount).toBe(1)
    expect(p.errors.event).toEqual({ mealPrice: MESSAGES.notWhole })
  })

  it('enforces the attendance rate range', () => {
    expect(parseBudget(makeState({ attendanceRate: '100' })).errorCount).toBe(0)
    expect(parseBudget(makeState({ attendanceRate: '101' })).errors.event.attendanceRate).toBe(MESSAGES.rateRange)
  })

  it('enforces maximum counts and amounts', () => {
    expect(parseBudget(makeState({ invitedGuests: '5000' })).errorCount).toBe(0)
    expect(parseBudget(makeState({ invitedGuests: '5001' })).errors.event.invitedGuests).toBe(MESSAGES.maxCount)
    expect(parseBudget(makeState({ minimumMeals: '5001' })).errors.event.minimumMeals).toBe(MESSAGES.maxCount)
    expect(parseBudget(makeState({ mealPrice: '10,000,000' })).errorCount).toBe(0)
    expect(parseBudget(makeState({ mealPrice: '10,000,001' })).errors.event.mealPrice).toBe(MESSAGES.maxMoney)
  })

  it('counts every invalid field', () => {
    const p = parseBudget(makeState({ invitedGuests: '-1', mealPrice: '1.5', averageGift: 'abc' }))
    expect(p.errorCount).toBe(3)
  })
})

describe('parseBudget — reserve guests', () => {
  it('parses an empty reserve price / gift as "same as the regular value" (null)', () => {
    const p = parseBudget(makeState({ reserveAvailable: '10', reserveGuests: '5' }))
    expect(p.values).toMatchObject({ reserveAvailable: 10, reserveGuests: 5, reserveMealPrice: null, reserveGift: null })
  })

  it('keeps an explicit 0 override (not the same as empty)', () => {
    const p = parseBudget(makeState({ reserveMealPrice: '0', reserveGift: '0' }))
    expect(p.values).toMatchObject({ reserveMealPrice: 0, reserveGift: 0 })
  })

  it('validates optional fields when they are filled', () => {
    const p = parseBudget(makeState({ reserveMealPrice: '20,0', reserveGift: '10,000,001' }))
    expect(p.errors.event).toEqual({ reserveMealPrice: MESSAGES.notWhole, reserveGift: MESSAGES.maxMoney })
  })

  it('does not allow more expected reserve guests than reserve places', () => {
    expect(parseBudget(makeState({ reserveAvailable: '10', reserveGuests: '10' })).errorCount).toBe(0)
    const p = parseBudget(makeState({ reserveAvailable: '10', reserveGuests: '11' }))
    expect(p.errors.event).toEqual({ reserveGuests: MESSAGES.reserveGuestsOverAvailable(10) })
    expect(MESSAGES.reserveGuestsOverAvailable(10)).toContain('(10)')
    expect(parseBudget(makeState({ reserveGuests: '3' })).errors.event.reserveGuests).toBe(MESSAGES.reserveGuestsOverAvailable(0))
  })

  it('does not stack the cross-field error on a malformed count', () => {
    const p = parseBudget(makeState({ reserveAvailable: 'x', reserveGuests: '5' }))
    expect(p.errors.event).toEqual({ reserveAvailable: MESSAGES.notWhole })
    expect(p.errorCount).toBe(1)
  })

  it('ignores a leftover billing-model field from older data', () => {
    const p = parseBudget(makeState({ reserveModel: 'prepaid' }))
    expect(p.errorCount).toBe(0)
    expect(p.values).not.toHaveProperty('reserveModel')
  })
})

describe('parseBudget — family gifts', () => {
  const gifts = (items, enabled = true) => ({ enabled, items })

  it('parses enabled family gifts and their total', () => {
    const p = parseBudget(makeState({}, [], gifts([{ id: 'p1', label: 'הורי הכלה', amount: '20,000' }, { id: 'p2', label: 'סבתא', amount: '5000' }])))
    expect(p.values.familyGiftsEnabled).toBe(true)
    expect(p.values.familyGifts).toEqual([{ id: 'p1', label: 'הורי הכלה', amount: 20_000 }, { id: 'p2', label: 'סבתא', amount: 5_000 }])
    expect(p.familyTotal).toBe(25_000)
    expect(p.isEmpty).toBe(false)
  })

  it('ignores disabled family gifts entirely — even invalid ones cannot block the summary', () => {
    const p = parseBudget(makeState({}, [], gifts([{ id: 'p1', label: '', amount: 'oops' }], false)))
    expect(p.errorCount).toBe(0)
    expect(p.values.familyGifts).toEqual([])
    expect(p.familyTotal).toBe(0)
  })

  it('requires a description only once a gift has an amount', () => {
    expect(parseBudget(makeState({}, [], gifts([{ id: 'p1', label: '', amount: '' }]))).errorCount).toBe(0)
    const p = parseBudget(makeState({}, [], gifts([{ id: 'p1', label: '  ', amount: '1000' }])))
    expect(p.errors.family).toEqual({ p1: { label: MESSAGES.familyLabelRequired } })
    expect(p.familyTotal).toBe(1_000) // a missing description does not hide the amount
  })

  it('validates amounts and description length', () => {
    const p = parseBudget(makeState({}, [], gifts([
      { id: 'a', label: 'x'.repeat(61), amount: '1' },
      { id: 'b', label: 'דוד', amount: '1,5' },
    ])))
    expect(p.errors.family).toEqual({ a: { label: MESSAGES.familyLabelTooLong }, b: { amount: MESSAGES.notWhole } })
    expect(p.familyTotal).toBeNull()
    expect(p.errorCount).toBe(2)
  })

})

describe('parseBudget — expenses', () => {
  it('requires a name only once the expense has an amount', () => {
    const empty = parseBudget(makeState({}, [{ id: 'a', name: '', amount: '' }]))
    expect(empty.errorCount).toBe(0)
    const withAmount = parseBudget(makeState({}, [{ id: 'a', name: '   ', amount: '500' }]))
    expect(withAmount.errors.expenses).toEqual({ a: { name: MESSAGES.expenseNameRequired } })
  })

  it('validates expense amounts', () => {
    const p = parseBudget(makeState({}, [
      { id: 'a', name: 'צלם', amount: '9,000-' },
      { id: 'b', name: 'די-ג׳יי', amount: '10,000,001' },
    ]))
    expect(p.errors.expenses).toEqual({ a: { amount: MESSAGES.notWhole }, b: { amount: MESSAGES.maxMoney } })
    expect(p.errorCount).toBe(2)
  })

  it('rejects names longer than 60 characters', () => {
    const p = parseBudget(makeState({}, [{ id: 'a', name: 'א'.repeat(61), amount: '1' }]))
    expect(p.errors.expenses.a.name).toBe(MESSAGES.expenseNameTooLong)
  })

  it('treats empty amounts as 0 ("not applicable")', () => {
    const p = parseBudget(makeState({ invitedGuests: '10' }, [{ id: 'a', name: 'צלם', amount: '' }]))
    expect(p.values.expenses[0].amount).toBe(0)
  })
})

describe('formatWholeInput', () => {
  it.each([
    ['15000', '15,000'],
    ['1,500', '1,500'],
    [' 350 ', '350'],
    ['1234567', '1,234,567'],
  ])('%j → %j', (raw, expected) => {
    expect(formatWholeInput(raw).replace(/[\u200e\u200f]/g, '')).toBe(expected)
  })

  it.each(['', '   ', '12א', '-5'])('leaves %j untouched', (raw) => {
    expect(formatWholeInput(raw)).toBe(raw)
  })
})

describe('parseBudget — partial results', () => {
  it('provides the venue cost even when an expense is invalid', () => {
    const p = parseBudget(makeState({ invitedGuests: '100', attendanceRate: '100', mealPrice: '300' }, [{ id: 'a', name: 'צלם', amount: 'x' }]))
    expect(p.values).toBeNull()
    expect(p.venueCost).toBe(30_000)
    expect(p.expensesTotal).toBeNull()
  })

  it('provides the expenses total even when an event field is invalid', () => {
    const p = parseBudget(makeState({ mealPrice: 'x' }, [{ id: 'a', name: 'צלם', amount: '9,000' }, { id: 'b', name: 'די-ג׳יי', amount: '6000' }]))
    expect(p.venueCost).toBeNull()
    expect(p.expensesTotal).toBe(15_000)
  })

  it('keeps the expenses total when only an expense NAME is missing', () => {
    const p = parseBudget(makeState({}, [{ id: 'a', name: '', amount: '500' }]))
    expect(p.errorCount).toBe(1)
    expect(p.expensesTotal).toBe(500)
  })
})

describe('parseBudget — isEmpty', () => {
  it('is empty with no guests and no costs', () => {
    expect(parseBudget(makeState({}, [{ id: 'a', name: 'צלם', amount: '' }])).isEmpty).toBe(true)
  })

  it('is NOT empty when there are expenses but no guests (the loss must be shown)', () => {
    expect(parseBudget(makeState({}, [{ id: 'a', name: 'צלם', amount: '5000' }])).isEmpty).toBe(false)
  })

  it('is NOT empty when a guaranteed minimum is billed with no guests', () => {
    expect(parseBudget(makeState({ mealPrice: '300', minimumMeals: '100' })).isEmpty).toBe(false)
  })

  it('is NOT empty when only reserve guests or family gifts are entered', () => {
    expect(parseBudget(makeState({ reserveAvailable: '5', reserveGuests: '5' })).isEmpty).toBe(false)
    expect(parseBudget(makeState({}, [], { enabled: true, items: [{ id: 'a', label: 'הורים', amount: '1000' }] })).isEmpty).toBe(false)
  })

  it('stays empty with family gifts switched on but no amounts yet', () => {
    expect(parseBudget(makeState({}, [], { enabled: true, items: [{ id: 'a', label: 'הורים', amount: '' }] })).isEmpty).toBe(true)
  })

  it('is NOT empty when guests are entered', () => {
    expect(parseBudget(makeState({ invitedGuests: '10' })).isEmpty).toBe(false)
  })

  it('is never empty while there are errors', () => {
    expect(parseBudget(makeState({ mealPrice: 'x' })).isEmpty).toBe(false)
  })
})
