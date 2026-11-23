import { describe, expect, it, vi } from 'vitest'
import {
  BUDGET_STORAGE_KEY,
  LEGACY_BUDGET_STORAGE_KEY,
  loadBudget,
  migrateLegacyBudget,
  sanitizeBudget,
  saveBudget,
} from './budgetStorage.js'
import { actions, budgetReducer, createInitialState } from './budgetState.js'
import { calculateBudget } from './budget.js'
import { parseBudget } from './validation.js'
import { readJSON, writeJSON } from './safeStorage.js'

const store = (key, value) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
const resultOf = (state) => calculateBudget(parseBudget(state).values)

// ── Budgets exactly as the published (version 1) site saved them ────────────────
const V1_EXPENSES = [
  { id: 'dj', name: 'די-ג׳יי', amount: '6,000' },
  { id: 'photographer', name: 'צלם', amount: '9,000' },
  { id: 'dress', name: 'שמלת כלה', amount: '8,000' },
  { id: 'flowers', name: 'עיצוב ופרחים', amount: '7,000' },
]
const v1 = (event, expenses = V1_EXPENSES) => ({
  version: 1,
  event: {
    invitedGuests: '', attendanceRate: '85', mealPrice: '', minimumMeals: '',
    reserveMeals: '', reserveMealPrice: '', averageGift: '', ...event,
  },
  expenses,
})
const V1_PROFIT = v1({ invitedGuests: '300', mealPrice: '350', minimumMeals: '250', averageGift: '505' })
const V1_LOSS = v1({ invitedGuests: '300', attendanceRate: '70', mealPrice: '380', minimumMeals: '250', reserveMeals: '10', reserveMealPrice: '200', averageGift: '450' })
const V1_ZERO = v1({ invitedGuests: '0', mealPrice: '350', minimumMeals: '250', averageGift: '450' })

describe('safeStorage', () => {
  it('round-trips JSON and never throws', () => {
    expect(writeJSON('k', { a: 1 })).toBe(true)
    expect(readJSON('k')).toEqual({ a: 1 })
    expect(readJSON('missing')).toBeNull()
    localStorage.setItem('bad', '{not json')
    expect(readJSON('bad')).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(readJSON('k')).toBeNull()
    expect(writeJSON('k', 1)).toBe(false)
  })
})

describe('current format (version 2)', () => {
  it('uses a new key, separate from the legacy one', () => {
    expect(BUDGET_STORAGE_KEY).toBe('wedding-budget:v2')
    expect(LEGACY_BUDGET_STORAGE_KEY).toBe('wedding-budget:v1')
  })

  it('returns defaults when nothing is stored', () => {
    expect(loadBudget()).toEqual(createInitialState())
  })

  it('round-trips everything the user entered', () => {
    let s = createInitialState()
    s = budgetReducer(s, actions.fieldChanged('invitedGuests', '300'))
    s = budgetReducer(s, actions.fieldChanged('reserveModel', 'prepaid'))
    s = budgetReducer(s, actions.fieldChanged('reserveAvailable', '12'))
    s = budgetReducer(s, actions.fieldChanged('reserveGuests', '5'))
    s = budgetReducer(s, actions.fieldChanged('reserveGift', '300'))
    s = budgetReducer(s, actions.familyGiftsToggled(true, [{ id: 'p', label: 'הורי הכלה', amount: '20,000' }]))
    s = budgetReducer(s, actions.expenseUpdated('dj', { amount: '6,000' }))
    expect(saveBudget(s)).toBe(true)
    const loaded = loadBudget()
    expect(loaded.event).toEqual(s.event)
    expect(loaded.expenses).toEqual(s.expenses)
    expect(loaded.familyGifts).toEqual(s.familyGifts)
    expect(loaded.lastValidValues).toEqual(s.lastValidValues)
  })

  it('stores only versioned raw input', () => {
    saveBudget(createInitialState())
    expect(Object.keys(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY)))).toEqual(['version', 'event', 'expenses', 'familyGifts', 'notices'])
  })

  it('restores invalid-but-well-formed input as typed (no silent reset)', () => {
    store(BUDGET_STORAGE_KEY, { version: 2, event: { mealPrice: '12א', reserveGuests: '9' }, expenses: [] })
    expect(loadBudget().event).toMatchObject({ mealPrice: '12א', reserveGuests: '9' })
  })

  it('falls back to defaults when reading throws or saving fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadBudget()).toEqual(createInitialState())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(saveBudget(createInitialState())).toBe(false)
  })
})

describe('sanitizeBudget (version 2)', () => {
  it.each([
    ['a string', '"hello"'], ['an array', '[]'], ['null', 'null'], ['an unknown version', { version: 99 }], ['version 1 data under the v2 key', { version: 1, event: {} }],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeBudget(typeof value === 'string' ? JSON.parse(value) : value)).toBeNull()
  })

  it('replaces wrongly typed fields with defaults and drops unknown keys', () => {
    const out = sanitizeBudget({
      version: 2,
      event: { invitedGuests: 300, mealPrice: '350', reserveModel: 'free', evil: '<script>' },
      familyGifts: { enabled: 'yes', items: 'nope' },
      notices: { reserveMigrated: 'true' },
    })
    expect(out.event).toMatchObject({ invitedGuests: '', mealPrice: '350', reserveModel: 'as-needed' })
    expect(out.event).not.toHaveProperty('evil')
    expect(out.familyGifts).toEqual({ enabled: false, items: [] })
    expect(out.notices).toEqual({ reserveMigrated: false })
  })

  it('truncates long values and limits/repairs rows', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: i < 2 ? 'dup' : `f${i}`, label: 'x'.repeat(100), amount: '1'.repeat(50) }))
    const out = sanitizeBudget({ version: 2, event: { mealPrice: '9'.repeat(99) }, expenses: [null, 5], familyGifts: { enabled: true, items: many } })
    expect(out.event.mealPrice).toHaveLength(20)
    expect(out.expenses).toEqual([])
    expect(out.familyGifts.items).toHaveLength(30)
    expect(out.familyGifts.items[0].label).toHaveLength(60)
    expect(out.familyGifts.items[0].amount).toHaveLength(20)
    expect(new Set(out.familyGifts.items.map((g) => g.id)).size).toBe(30)
  })
})

describe('migration of budgets saved by the published version 1 site', () => {
  it('loads a v1 budget when no v2 data exists, with identical results (profit sample)', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_PROFIT)
    const s = loadBudget()
    expect(s.event).toMatchObject({ invitedGuests: '300', mealPrice: '350', minimumMeals: '250', averageGift: '505', attendanceRate: '85' })
    expect(s.expenses).toEqual(V1_EXPENSES)
    const r = resultOf(s)
    expect(r).toMatchObject({ totalCost: 119_250, totalIncome: 128_775, balance: 9_525, breakEvenGift: 468, breakEvenMealPrice: { status: 'ok', value: 387 } })
    expect(s.notices.reserveMigrated).toBe(false) // nothing to explain
  })

  it('carries old reserve meals over as prepaid reserve with no extra guests — same numbers', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_LOSS)
    const s = loadBudget()
    expect(s.event).toMatchObject({ reserveModel: 'prepaid', reserveAvailable: '10', reserveGuests: '', reserveMealPrice: '200', reserveGift: '' })
    const r = resultOf(s)
    expect(r).toMatchObject({
      attendingGuests: 210, mainMeals: 250, unusedMeals: 40, reserveCost: 2_000, venueCost: 97_000,
      totalCost: 127_000, totalIncome: 94_500, balance: -32_500, breakEvenGift: 605,
      breakEvenMealPrice: { status: 'ok', value: 250 },
    })
    expect(s.notices.reserveMigrated).toBe(true) // the user is told how the reserve was carried over
  })

  it('keeps the zero-guest sample identical', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_ZERO)
    expect(resultOf(loadBudget())).toMatchObject({ attendingGuests: 0, totalCost: 117_500, balance: -117_500, breakEvenGift: null })
  })

  it('does not reinterpret an empty or zero reserve as anything', () => {
    for (const reserveMeals of ['', '0']) {
      const s = migrateLegacyBudget(v1({ reserveMeals, reserveMealPrice: '200' }))
      expect(s.event).toMatchObject({ reserveModel: 'as-needed', reserveAvailable: '', reserveMealPrice: '' })
      expect(s.notices.reserveMigrated).toBe(false)
    }
  })

  it('keeps invalid v1 input exactly as typed, so the user still sees the error', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, v1({ mealPrice: '35O', reserveMeals: '1O' }))
    const s = loadBudget()
    expect(s.event.mealPrice).toBe('35O')
    expect(s.event.reserveAvailable).toBe('1O')
    expect(parseBudget(s).errors.event).toMatchObject({ mealPrice: expect.any(String), reserveAvailable: expect.any(String) })
  })

  it('never writes to or deletes the legacy key (safe rollback)', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_LOSS)
    const before = localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)
    let s = loadBudget()
    s = budgetReducer(s, actions.fieldChanged('averageGift', '500'))
    saveBudget(s)
    expect(localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)).toBe(before)
    expect(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY)).version).toBe(2)
  })

  it('prefers v2 data once it exists (the migration runs only once)', () => {
    store(LEGACY_BUDGET_STORAGE_KEY, V1_LOSS)
    let s = loadBudget()
    s = budgetReducer(s, actions.reserveNoticeDismissed())
    s = budgetReducer(s, actions.fieldChanged('averageGift', '500'))
    saveBudget(s)
    const reloaded = loadBudget()
    expect(reloaded.event.averageGift).toBe('500')
    expect(reloaded.notices.reserveMigrated).toBe(false) // dismissed notice stays dismissed
  })

  it('falls back to defaults for corrupted legacy data', () => {
    for (const bad of ['{oops', '"x"', '[]', JSON.stringify({ version: 7 })]) {
      localStorage.clear()
      store(LEGACY_BUDGET_STORAGE_KEY, bad)
      expect(loadBudget()).toEqual(createInitialState())
    }
  })

  // Regression: a v1 budget without reserve fields crashed the migration (undefined.trim()).
  it('migrates v1 data that is missing fields, using defaults', () => {
    const s = migrateLegacyBudget({ version: 1, event: { invitedGuests: '300' }, expenses: [] })
    expect(s.event).toMatchObject({ invitedGuests: '300', attendanceRate: '85', reserveAvailable: '', reserveMealPrice: '', reserveModel: 'as-needed' })
    expect(migrateLegacyBudget({ version: 1 })).toMatchObject({ expenses: [], notices: { reserveMigrated: false } })
  })

  it('sanitizes legacy fields too (types, lengths, ids)', () => {
    const s = migrateLegacyBudget({
      version: 1,
      event: { invitedGuests: 300, mealPrice: '9'.repeat(50), reserveMeals: '5' },
      expenses: [{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }, 'bad'],
    })
    expect(s.event.invitedGuests).toBe('')
    expect(s.event.mealPrice).toHaveLength(20)
    expect(s.event.reserveMealPrice).toBe('') // follows the regular price, explained by the notice
    expect(new Set(s.expenses.map((e) => e.id)).size).toBe(2)
  })
})
