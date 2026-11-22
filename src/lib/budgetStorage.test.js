import { describe, expect, it, vi } from 'vitest'
import { BUDGET_STORAGE_KEY, loadBudget, sanitizeBudget, saveBudget } from './budgetStorage.js'
import { actions, budgetReducer, createInitialState } from './budgetState.js'
import { readJSON, writeJSON } from './safeStorage.js'

const store = (value) => localStorage.setItem(BUDGET_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))

describe('safeStorage', () => {
  it('round-trips JSON', () => {
    expect(writeJSON('k', { a: 1 })).toBe(true)
    expect(readJSON('k')).toEqual({ a: 1 })
  })

  it('returns null for missing keys and malformed JSON', () => {
    expect(readJSON('missing')).toBeNull()
    localStorage.setItem('bad', '{not json')
    expect(readJSON('bad')).toBeNull()
  })

  it('never throws when storage access fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(readJSON('k')).toBeNull()
    expect(writeJSON('k', 1)).toBe(false)
  })
})

describe('loadBudget / saveBudget', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadBudget()).toEqual(createInitialState())
  })

  it('round-trips the user input', () => {
    let s = createInitialState()
    s = budgetReducer(s, actions.fieldChanged('invitedGuests', '300'))
    s = budgetReducer(s, actions.expenseUpdated('dj', { amount: '6,000' }))
    expect(saveBudget(s)).toBe(true)
    const loaded = loadBudget()
    expect(loaded.event).toEqual(s.event)
    expect(loaded.expenses).toEqual(s.expenses)
    expect(loaded.lastValidValues).toEqual(s.lastValidValues)
  })

  it('stores only the versioned input', () => {
    saveBudget(createInitialState())
    expect(Object.keys(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY)))).toEqual(['version', 'event', 'expenses'])
  })

  it.each([
    ['malformed JSON', '{oops'],
    ['a string', '"hello"'],
    ['an array', '[]'],
    ['null', 'null'],
    ['an unknown version', { version: 99, event: {}, expenses: [] }],
    ['a missing version', { event: {}, expenses: [] }],
  ])('falls back to defaults for %s', (_label, value) => {
    store(value)
    expect(loadBudget()).toEqual(createInitialState())
  })

  it('falls back to defaults when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadBudget()).toEqual(createInitialState())
  })

  it('reports a failed save without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(saveBudget(createInitialState())).toBe(false)
  })

  it('restores invalid-but-well-formed input as typed (no silent reset)', () => {
    store({ version: 1, event: { mealPrice: '12א' }, expenses: [] })
    const s = loadBudget()
    expect(s.event.mealPrice).toBe('12א')
  })
})

describe('sanitizeBudget', () => {
  it('replaces wrongly typed event fields with defaults and drops unknown keys', () => {
    const out = sanitizeBudget({ version: 1, event: { invitedGuests: 300, attendanceRate: null, mealPrice: '350', evil: '<script>' }, expenses: [] })
    expect(out.event).toEqual({
      invitedGuests: '', attendanceRate: '85', mealPrice: '350', minimumMeals: '',
      reserveMeals: '', reserveMealPrice: '', averageGift: '',
    })
  })

  it('truncates overly long values', () => {
    const out = sanitizeBudget({ version: 1, event: { mealPrice: '9'.repeat(100) }, expenses: [{ id: 'a', name: 'א'.repeat(200), amount: '1'.repeat(100) }] })
    expect(out.event.mealPrice).toHaveLength(20)
    expect(out.expenses[0].name).toHaveLength(60)
    expect(out.expenses[0].amount).toHaveLength(20)
  })

  it('limits the number of expenses and skips non-object items', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `e${i}`, name: 'x', amount: '1' }))
    const out = sanitizeBudget({ version: 1, event: {}, expenses: [null, 'x', 5, ...many] })
    expect(out.expenses).toHaveLength(50)
    expect(out.expenses[0].id).toBe('e0')
  })

  it('fixes missing or duplicate expense ids', () => {
    const out = sanitizeBudget({ version: 1, event: {}, expenses: [{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }, { name: 'z' }] })
    const ids = out.expenses.map((e) => e.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('a')
    expect(out.expenses[2].amount).toBe('')
  })

  it('treats a non-array expenses field as an empty list', () => {
    expect(sanitizeBudget({ version: 1, event: {}, expenses: 'nope' }).expenses).toEqual([])
  })
})
