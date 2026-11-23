import { describe, expect, it, vi } from 'vitest'
import {
  BUDGET_STORAGE_KEY,
  LEGACY_BUDGET_STORAGE_KEY,
  loadBudget,
  migrateLegacyBudget,
  migratePreviousBudget,
  PREVIOUS_BUDGET_STORAGE_KEY,
  sanitizeBudget,
  saveBudget,
} from './budgetStorage.js'
import { actions, budgetReducer, createInitialState, PREPAID_RESERVE_EXPENSE_NAME } from './budgetState.js'
import { calculateBudget } from './budget.js'
import { formatNumber } from './format.js'
import { parseBudget } from './validation.js'
import { readJSON, writeJSON } from './safeStorage.js'

const store = (key, value) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
const resultOf = (state) => calculateBudget(parseBudget(state).values)
/** What the migration notice's "add as expense" button does. */
const acceptSuggestion = (state) =>
  budgetReducer(state, actions.prepaidReserveExpenseAdded({
    id: 'kept', name: PREPAID_RESERVE_EXPENSE_NAME, amount: formatNumber(state.notices.prepaidReserve.suggestedExpense),
  }))

const EXPENSES = [
  { id: 'dj', name: 'די-ג׳יי', amount: '6,000' },
  { id: 'photographer', name: 'צלם', amount: '9,000' },
  { id: 'dress', name: 'שמלת כלה', amount: '8,000' },
  { id: 'flowers', name: 'עיצוב ופרחים', amount: '7,000' },
]

// ── Budgets exactly as the published sites saved them ───────────────────────────
const v1 = (event, expenses = EXPENSES) => ({
  version: 1,
  event: { invitedGuests: '', attendanceRate: '85', mealPrice: '', minimumMeals: '', reserveMeals: '', reserveMealPrice: '', averageGift: '', ...event },
  expenses,
})
const V1_PROFIT = v1({ invitedGuests: '300', mealPrice: '350', minimumMeals: '250', averageGift: '505' })
const V1_LOSS = v1({ invitedGuests: '300', attendanceRate: '70', mealPrice: '380', minimumMeals: '250', reserveMeals: '10', reserveMealPrice: '200', averageGift: '450' })

const v2 = (event, extra = {}) => ({
  version: 2,
  event: {
    invitedGuests: '300', attendanceRate: '70', mealPrice: '380', minimumMeals: '250', averageGift: '450',
    reserveModel: 'as-needed', reserveAvailable: '', reserveGuests: '', reserveMealPrice: '', reserveGift: '', ...event,
  },
  expenses: EXPENSES,
  familyGifts: { enabled: true, items: [{ id: 'p', label: 'הורים', amount: '20,000' }] },
  notices: { reserveMigrated: false },
  ...extra,
})

describe('safeStorage', () => {
  it('round-trips JSON and never throws', () => {
    expect(writeJSON('k', { a: 1 })).toBe(true)
    expect(readJSON('k')).toEqual({ a: 1 })
    localStorage.setItem('bad', '{not json')
    expect(readJSON('bad')).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(readJSON('k')).toBeNull()
    expect(writeJSON('k', 1)).toBe(false)
  })
})

describe('current format (version 3)', () => {
  it('uses its own key; older keys are separate', () => {
    expect([BUDGET_STORAGE_KEY, PREVIOUS_BUDGET_STORAGE_KEY, LEGACY_BUDGET_STORAGE_KEY]).toEqual(['wedding-budget:v3', 'wedding-budget:v2', 'wedding-budget:v1'])
  })

  it('returns defaults when nothing is stored', () => {
    expect(loadBudget()).toEqual(createInitialState())
  })

  it('round-trips everything the user entered', () => {
    let s = createInitialState()
    for (const [k, v] of Object.entries({ invitedGuests: '300', reserveAvailable: '12', reserveGuests: '5', reserveGift: '300' })) {
      s = budgetReducer(s, actions.fieldChanged(k, v))
    }
    s = budgetReducer(s, actions.familyGiftsToggled(true, [{ id: 'p', label: 'הורי הכלה', amount: '20,000' }]))
    expect(saveBudget(s)).toBe(true)
    const loaded = loadBudget()
    expect(loaded.event).toEqual(s.event)
    expect(loaded.familyGifts).toEqual(s.familyGifts)
    expect(loaded.lastValidValues).toEqual(s.lastValidValues)
  })

  it('stores only versioned raw input', () => {
    saveBudget(createInitialState())
    const saved = JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY))
    expect(Object.keys(saved)).toEqual(['version', 'event', 'expenses', 'familyGifts', 'notices'])
    expect(saved.version).toBe(3)
  })

  it('restores invalid-but-well-formed input as typed (no silent reset)', () => {
    store(BUDGET_STORAGE_KEY, { version: 3, event: { mealPrice: '12א', reserveGuests: '9' }, expenses: [] })
    expect(loadBudget().event).toMatchObject({ mealPrice: '12א', reserveGuests: '9' })
  })

  it('falls back to defaults when reading throws or saving fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadBudget()).toEqual(createInitialState())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(saveBudget(createInitialState())).toBe(false)
  })
})

describe('sanitizeBudget (version 3)', () => {
  it.each([['a string', 'hello'], ['an array', []], ['null', null], ['an unknown version', { version: 99 }], ['older data under the v3 key', { version: 2, event: {} }]])(
    'rejects %s',
    (_label, value) => expect(sanitizeBudget(value)).toBeNull(),
  )

  it('drops unknown and removed fields (e.g. the old billing model)', () => {
    const out = sanitizeBudget({ version: 3, event: { invitedGuests: 300, mealPrice: '350', reserveModel: 'prepaid', evil: 'x' }, familyGifts: { enabled: 'yes' } })
    expect(out.event).toMatchObject({ invitedGuests: '', mealPrice: '350' })
    expect(out.event).not.toHaveProperty('reserveModel')
    expect(out.event).not.toHaveProperty('evil')
    expect(out.familyGifts).toEqual({ enabled: false, items: [] })
  })

  it('validates the stored notice', () => {
    const ok = sanitizeBudget({ version: 3, notices: { prepaidReserve: { meals: '10', previousCost: 2000, suggestedExpense: 2000 } } })
    expect(ok.notices.prepaidReserve).toEqual({ meals: '10', previousCost: 2000, suggestedExpense: 2000 })
    const bad = sanitizeBudget({ version: 3, notices: { prepaidReserve: { meals: 5, previousCost: -1, suggestedExpense: 1.5 } } })
    expect(bad.notices.prepaidReserve).toEqual({ meals: '', previousCost: null, suggestedExpense: null })
    expect(sanitizeBudget({ version: 3, notices: { prepaidReserve: 'x' } }).notices.prepaidReserve).toBeNull()
  })
})

describe('migration from version 2 (billing models)', () => {
  it('keeps "as needed" budgets exactly as they were, with no notice', () => {
    const data = v2({ reserveAvailable: '60', reserveGuests: '50', reserveMealPrice: '300', reserveGift: '400' })
    store(PREVIOUS_BUDGET_STORAGE_KEY, data)
    const s = loadBudget()
    expect(s.event).toMatchObject({ reserveAvailable: '60', reserveGuests: '50', reserveMealPrice: '300', reserveGift: '400' })
    expect(s.familyGifts).toEqual(data.familyGifts)
    expect(s.notices.prepaidReserve).toBeNull()
    // 40 reserve guests in unused guaranteed meals, 10 billed × 300.
    expect(resultOf(s)).toMatchObject({ reserveCost: 3_000, reserveGiftIncome: 20_000 })
  })

  it('turns prepaid reserve into "pay only for who comes", keeping places and guests, and explains it', () => {
    store(PREVIOUS_BUDGET_STORAGE_KEY, v2({ reserveModel: 'prepaid', reserveAvailable: '20', reserveGuests: '15', reserveMealPrice: '200' }))
    const s = loadBudget()
    expect(s.event).toMatchObject({ reserveAvailable: '20', reserveGuests: '15', reserveMealPrice: '200' })
    expect(s.event).not.toHaveProperty('reserveModel')
    // Before: 20 × 200 = 4,000 prepaid. Now: the 15 guests use unused guaranteed meals → 0.
    expect(s.notices.prepaidReserve).toEqual({ meals: '20', previousCost: 4_000, suggestedExpense: 4_000 })
    expect(resultOf(s).reserveCost).toBe(0)
  })

  it('the suggested expense restores the previous balance exactly (prepaid with charged guests)', () => {
    // 270 base guests, minimum 250 → no spare guaranteed meals; 15 of 20 prepaid places used.
    const data = v2({ attendanceRate: '90', reserveModel: 'prepaid', reserveAvailable: '20', reserveGuests: '15', reserveMealPrice: '200' })
    const before = 270 * 450 + 15 * 450 + 20_000 - (270 * 380 + 20 * 200 + 30_000) // the v2 result
    store(PREVIOUS_BUDGET_STORAGE_KEY, data)
    const s = loadBudget()
    expect(s.notices.prepaidReserve).toEqual({ meals: '20', previousCost: 4_000, suggestedExpense: 1_000 }) // 4,000 − 15 × 200
    expect(resultOf(acceptSuggestion(s)).balance).toBe(before)
  })

  it('gives a notice without amounts when the stored numbers are invalid', () => {
    store(PREVIOUS_BUDGET_STORAGE_KEY, v2({ reserveModel: 'prepaid', reserveAvailable: '2O', mealPrice: '380' }))
    expect(loadBudget().notices.prepaidReserve).toEqual({ meals: '2O', previousCost: null, suggestedExpense: null })
  })

  it('needs no notice for prepaid with no reserve places', () => {
    expect(migratePreviousBudget(v2({ reserveModel: 'prepaid', reserveAvailable: '0' })).notices.prepaidReserve).toBeNull()
  })

  it('never writes to or deletes the version 2 key, and migrates only once', () => {
    store(PREVIOUS_BUDGET_STORAGE_KEY, v2({ reserveModel: 'prepaid', reserveAvailable: '20', reserveMealPrice: '200' }))
    const before = localStorage.getItem(PREVIOUS_BUDGET_STORAGE_KEY)
    let s = loadBudget()
    s = budgetReducer(s, actions.reserveNoticeDismissed())
    saveBudget(s)
    expect(localStorage.getItem(PREVIOUS_BUDGET_STORAGE_KEY)).toBe(before)
    expect(loadBudget().notices.prepaidReserve).toBeNull() // v3 now wins; the notice does not come back
  })
})

describe('migration from version 1 (cost-only reserve meals)', () => {
  it('keeps budgets without reserve identical, with no notice', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_PROFIT)
    const s = loadBudget()
    expect(resultOf(s)).toMatchObject({ totalCost: 119_250, totalIncome: 128_775, balance: 9_525, breakEvenGift: 468 })
    expect(s.notices.prepaidReserve).toBeNull()
  })

  it('turns old reserve meals into reserve places and explains the removed cost', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_LOSS)
    const s = loadBudget()
    expect(s.event).toMatchObject({ reserveAvailable: '10', reserveGuests: '', reserveMealPrice: '200' })
    expect(s.notices.prepaidReserve).toEqual({ meals: '10', previousCost: 2_000, suggestedExpense: 2_000 })
    expect(resultOf(s).balance).toBe(-30_500) // without the old ₪2,000 reserve cost
  })

  it('accepting the suggestion restores every published number exactly', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_LOSS)
    const r = resultOf(acceptSuggestion(loadBudget()))
    expect(r).toMatchObject({ totalCost: 127_000, totalIncome: 94_500, balance: -32_500, breakEvenGift: 605, breakEvenMealPrice: { status: 'ok', value: 250 } })
  })

  it('prefers the newest data: v3 over v2 over v1', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_PROFIT)
    store(PREVIOUS_BUDGET_STORAGE_KEY, v2({ averageGift: '999' }))
    expect(loadBudget().event.averageGift).toBe('999')
    store(BUDGET_STORAGE_KEY, { version: 3, event: { averageGift: '111' } })
    expect(loadBudget().event.averageGift).toBe('111')
  })

  it('never modifies the version 1 key', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_LOSS)
    const before = localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)
    saveBudget(budgetReducer(loadBudget(), actions.fieldChanged('averageGift', '500')))
    expect(localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)).toBe(before)
  })

  it('keeps invalid input as typed and copes with missing fields', () => {
    expect(migrateLegacyBudget(v1({ mealPrice: '35O', reserveMeals: '1O' })).event).toMatchObject({ mealPrice: '35O', reserveAvailable: '1O' })
    const sparse = migrateLegacyBudget({ version: 1, event: { invitedGuests: '300' } })
    expect(sparse.event).toMatchObject({ invitedGuests: '300', attendanceRate: '85', reserveAvailable: '' })
    expect(sparse.notices.prepaidReserve).toBeNull()
  })

  it('falls back to defaults for corrupted older data', () => {
    for (const [key, bad] of [[LEGACY_BUDGET_STORAGE_KEY, '{oops'], [PREVIOUS_BUDGET_STORAGE_KEY, '[]'], [PREVIOUS_BUDGET_STORAGE_KEY, JSON.stringify({ version: 7 })]]) {
      localStorage.clear()
      store(key, bad)
      expect(loadBudget()).toEqual(createInitialState())
    }
  })
})
