// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  actions,
  budgetReducer,
  createDefaultExpenses,
  createExpense,
  createInitialState,
  MAX_EXPENSES,
  toPersisted,
} from './budgetState.js'

const fill = (state, fields) =>
  Object.entries(fields).reduce((s, [k, v]) => budgetReducer(s, actions.fieldChanged(k, v)), state)

describe('createInitialState', () => {
  it('starts with empty fields, an illustrative 85% attendance and the three default expenses', () => {
    const s = createInitialState()
    expect(s.event.invitedGuests).toBe('')
    expect(s.event.attendanceRate).toBe('85')
    expect(s.expenses.map((e) => e.name)).toEqual(['די-ג׳יי', 'צלם', 'שמלת כלה'])
    expect(s.expenses.every((e) => e.amount === '')).toBe(true)
    expect(s.lastValidValues).toBeNull()
  })

  it('computes lastValidValues from restored data', () => {
    const s = createInitialState({
      event: { ...createInitialState().event, invitedGuests: '100', mealPrice: '300' },
      expenses: createDefaultExpenses(),
    })
    expect(s.lastValidValues.invitedGuests).toBe(100)
  })
})

describe('budgetReducer — fields', () => {
  it('updates a known field and keeps the raw string', () => {
    const s = budgetReducer(createInitialState(), actions.fieldChanged('mealPrice', '1,500'))
    expect(s.event.mealPrice).toBe('1,500')
  })

  it('ignores unknown fields', () => {
    const before = createInitialState()
    expect(budgetReducer(before, actions.fieldChanged('hack', '1'))).toBe(before)
  })

  it('returns the same state for unknown actions', () => {
    const before = createInitialState()
    expect(budgetReducer(before, { type: 'nope' })).toBe(before)
  })
})

describe('budgetReducer — lastValidValues', () => {
  it('tracks the latest valid input', () => {
    const s = fill(createInitialState(), { invitedGuests: '100', mealPrice: '300' })
    expect(s.lastValidValues).toMatchObject({ invitedGuests: 100, mealPrice: 300 })
  })

  it('keeps the last valid values while a field is invalid', () => {
    const valid = fill(createInitialState(), { invitedGuests: '100', mealPrice: '300' })
    const invalid = budgetReducer(valid, actions.fieldChanged('mealPrice', '3x0'))
    expect(invalid.event.mealPrice).toBe('3x0')
    expect(invalid.lastValidValues).toEqual(valid.lastValidValues)
  })

  it('updates again once the error is fixed', () => {
    let s = fill(createInitialState(), { invitedGuests: '100', mealPrice: '300' })
    s = budgetReducer(s, actions.fieldChanged('mealPrice', '3x0'))
    s = budgetReducer(s, actions.fieldChanged('mealPrice', '320'))
    expect(s.lastValidValues.mealPrice).toBe(320)
  })

  it('clears when the form becomes empty', () => {
    let s = fill(createInitialState(), { invitedGuests: '100' })
    s = budgetReducer(s, actions.fieldChanged('invitedGuests', ''))
    expect(s.lastValidValues).toBeNull()
  })
})

describe('budgetReducer — expenses', () => {
  it('adds an expense at the end', () => {
    const expense = { id: 'x', name: '', amount: '' }
    const s = budgetReducer(createInitialState(), actions.expenseAdded(expense))
    expect(s.expenses.at(-1)).toEqual(expense)
    expect(s.expenses).toHaveLength(4)
  })

  it(`stops adding at ${MAX_EXPENSES} expenses`, () => {
    let s = createInitialState()
    for (let i = 0; i < MAX_EXPENSES + 5; i++) s = budgetReducer(s, actions.expenseAdded({ id: `x${i}`, name: '', amount: '' }))
    expect(s.expenses).toHaveLength(MAX_EXPENSES)
  })

  it('updates only name/amount of the targeted expense', () => {
    const s = budgetReducer(createInitialState(), actions.expenseUpdated('photographer', { name: 'צלם מגנטים', amount: '4,000', id: 'evil' }))
    const photographer = s.expenses.find((e) => e.id === 'photographer')
    expect(photographer).toEqual({ id: 'photographer', name: 'צלם מגנטים', amount: '4,000' })
    expect(s.expenses.find((e) => e.id === 'dj').name).toBe('די-ג׳יי')
  })

  it('removes an expense and restores it at its original index', () => {
    const start = createInitialState()
    const removed = budgetReducer(start, actions.expenseRemoved('photographer'))
    expect(removed.expenses.map((e) => e.id)).toEqual(['dj', 'dress'])
    const restored = budgetReducer(removed, actions.expenseRestored(start.expenses[1], 1))
    expect(restored.expenses.map((e) => e.id)).toEqual(['dj', 'photographer', 'dress'])
  })

  it('clamps the restore index and never duplicates an expense', () => {
    const start = createInitialState()
    const restoredFar = budgetReducer(budgetReducer(start, actions.expenseRemoved('dj')), actions.expenseRestored(start.expenses[0], 99))
    expect(restoredFar.expenses.map((e) => e.id)).toEqual(['photographer', 'dress', 'dj'])
    expect(budgetReducer(start, actions.expenseRestored(start.expenses[0], 0))).toBe(start)
  })

  it('recomputes lastValidValues after expense changes', () => {
    let s = fill(createInitialState(), { invitedGuests: '100' })
    s = budgetReducer(s, actions.expenseUpdated('dj', { amount: '6000' }))
    expect(s.lastValidValues.expenses.find((e) => e.id === 'dj').amount).toBe(6000)
  })
})

describe('budgetReducer — reset', () => {
  it('returns to the defaults', () => {
    let s = fill(createInitialState(), { invitedGuests: '100', mealPrice: '300' })
    s = budgetReducer(s, actions.expenseRemoved('dj'))
    s = budgetReducer(s, actions.reset())
    expect(s).toEqual(createInitialState())
  })
})

describe('helpers', () => {
  it('createExpense returns unique, empty expenses', () => {
    const a = createExpense()
    const b = createExpense()
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ name: '', amount: '' })
  })

  it('toPersisted stores only versioned raw input, never derived values', () => {
    const s = fill(createInitialState(), { invitedGuests: '100' })
    expect(toPersisted(s)).toEqual({ version: 1, event: s.event, expenses: s.expenses })
  })
})
