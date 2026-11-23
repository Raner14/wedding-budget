// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  MAX_EXPENSES,
  MAX_FAMILY_GIFTS,
  actions,
  budgetReducer,
  createDefaultExpenses,
  createExpense,
  createInitialState,
  createSuggestedFamilyGifts,
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
    expect(toPersisted(s)).toEqual({ version: 2, event: s.event, expenses: s.expenses, familyGifts: s.familyGifts, notices: s.notices })
    expect(toPersisted(s)).not.toHaveProperty('lastValidValues')
  })
})

describe('budgetReducer — reserve fields', () => {
  it('starts with no reserve and the "pay as needed" model', () => {
    expect(createInitialState().event).toMatchObject({
      reserveModel: 'as-needed', reserveAvailable: '', reserveGuests: '', reserveMealPrice: '', reserveGift: '',
    })
  })

  it('switches the billing model, and ignores unknown models', () => {
    const s = budgetReducer(createInitialState(), actions.fieldChanged('reserveModel', 'prepaid'))
    expect(s.event.reserveModel).toBe('prepaid')
    expect(budgetReducer(s, actions.fieldChanged('reserveModel', 'free-food'))).toBe(s)
  })

  it('reserve guests change the last valid values', () => {
    const s = fill(createInitialState(), { invitedGuests: '100', reserveAvailable: '10', reserveGuests: '4' })
    expect(s.lastValidValues).toMatchObject({ reserveAvailable: 10, reserveGuests: 4 })
  })

  it('dismisses the migration notice once', () => {
    const migrated = createInitialState({ ...createInitialState(), notices: { reserveMigrated: true } })
    const dismissed = budgetReducer(migrated, actions.reserveNoticeDismissed())
    expect(dismissed.notices.reserveMigrated).toBe(false)
    expect(budgetReducer(dismissed, actions.reserveNoticeDismissed())).toBe(dismissed)
  })
})

describe('budgetReducer — family gifts', () => {
  const suggested = [{ id: 'f1', label: 'הורי הכלה', amount: '' }, { id: 'f2', label: 'הורי החתן', amount: '' }]

  it('starts disabled and empty', () => {
    expect(createInitialState().familyGifts).toEqual({ enabled: false, items: [] })
  })

  it('adds the suggested rows the first time it is switched on', () => {
    const s = budgetReducer(createInitialState(), actions.familyGiftsToggled(true, suggested))
    expect(s.familyGifts).toEqual({ enabled: true, items: suggested })
  })

  it('keeps existing rows when switched off and on again (no duplicates)', () => {
    let s = budgetReducer(createInitialState(), actions.familyGiftsToggled(true, suggested))
    s = budgetReducer(s, actions.familyGiftUpdated('f1', { amount: '20,000' }))
    s = budgetReducer(s, actions.familyGiftsToggled(false))
    expect(s.familyGifts.items).toHaveLength(2)
    s = budgetReducer(s, actions.familyGiftsToggled(true, [{ id: 'x', label: 'x', amount: '' }]))
    expect(s.familyGifts.items.map((g) => g.id)).toEqual(['f1', 'f2'])
    expect(s.familyGifts.items[0].amount).toBe('20,000')
  })

  it('returns the same state when toggling to the current value', () => {
    const s = createInitialState()
    expect(budgetReducer(s, actions.familyGiftsToggled(false))).toBe(s)
  })

  it('adds, edits (label/amount only) and removes gifts', () => {
    let s = budgetReducer(createInitialState(), actions.familyGiftsToggled(true))
    s = budgetReducer(s, actions.familyGiftAdded({ id: 'g', label: '', amount: '' }))
    s = budgetReducer(s, actions.familyGiftUpdated('g', { label: 'סבא וסבתא', amount: '5000', id: 'evil' }))
    expect(s.familyGifts.items).toEqual([{ id: 'g', label: 'סבא וסבתא', amount: '5000' }])
    s = budgetReducer(s, actions.familyGiftRemoved('g'))
    expect(s.familyGifts.items).toEqual([])
    expect(budgetReducer(s, actions.familyGiftRemoved('nope'))).toBe(s)
  })

  it(`stops adding at ${MAX_FAMILY_GIFTS} gifts`, () => {
    let s = budgetReducer(createInitialState(), actions.familyGiftsToggled(true))
    for (let i = 0; i < MAX_FAMILY_GIFTS + 3; i++) s = budgetReducer(s, actions.familyGiftAdded({ id: `g${i}`, label: '', amount: '' }))
    expect(s.familyGifts.items).toHaveLength(MAX_FAMILY_GIFTS)
  })

  it('only counts family gifts while enabled', () => {
    let s = fill(createInitialState(), { invitedGuests: '10' })
    s = budgetReducer(s, actions.familyGiftsToggled(true, [{ id: 'g', label: 'הורים', amount: '1000' }]))
    expect(s.lastValidValues.familyGifts).toEqual([{ id: 'g', label: 'הורים', amount: 1000 }])
    s = budgetReducer(s, actions.familyGiftsToggled(false))
    expect(s.lastValidValues.familyGiftsEnabled).toBe(false)
    expect(s.lastValidValues.familyGifts).toEqual([])
  })

  it('createSuggestedFamilyGifts offers the parents with unique ids', () => {
    const rows = createSuggestedFamilyGifts()
    expect(rows.map((r) => r.label)).toEqual(['הורי הכלה', 'הורי החתן'])
    expect(rows[0].id).not.toBe(rows[1].id)
  })

  it('reset clears family gifts and notices too', () => {
    let s = budgetReducer(createInitialState(), actions.familyGiftsToggled(true, suggested))
    s = budgetReducer(s, actions.reset())
    expect(s).toEqual(createInitialState())
  })
})
