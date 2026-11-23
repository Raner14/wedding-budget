import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { normalize, SAMPLES, seedBudget, seedBudgetV2 } from './test/helpers.js'
import { BUDGET_STORAGE_KEY, LEGACY_BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'

const EXPENSES = [{ id: 'all', name: 'הוצאות', amount: '30,000' }]
// 300 invited × 70% = 210 guests; minimum 250 → 40 guaranteed meals paid but unused.
const BASE = { invitedGuests: '300', attendanceRate: '70', mealPrice: '380', minimumMeals: '250', averageGift: '450' }

const balance = () => normalize(screen.getByTestId('balance').textContent)
const summary = () => normalize(document.getElementById('summary').textContent)
const explanation = () => normalize(document.querySelector('.reserve-explanation')?.textContent)
const attendingText = () => normalize(screen.getByText(/צפויים לחגוג איתכם/).closest('p').textContent)
const stored = () => JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY))

describe('Reserve guests — model A (pay only for what is needed)', () => {
  it('without reserve guests the result is unchanged', () => {
    seedBudgetV2({ event: BASE, expenses: EXPENSES })
    renderApp()
    expect(balance()).toContain('30,500') // 210×450 − (250×380 + 30,000)
  })

  it('reserve guests fill unused guaranteed meals: more gifts, no extra meal cost', () => {
    seedBudgetV2({ event: { ...BASE, reserveAvailable: '20', reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    expect(attendingText()).toContain('≈ 225 אורחים')
    expect(attendingText()).toContain('כולל 15 מהרזרבה')
    expect(balance()).toContain('הפסד צפוי')
    expect(balance()).toContain('23,750') // 225×450 − 125,000
    expect(summary()).toContain('+ 15 אורחי רזרבה × 450')
    expect(summary()).toContain('בגלל מינימום המנות תשלמו על 25 מנות שלא ינוצלו')
    expect(explanation()).toContain('15 מהם במנות מובטחות שכבר שולמו')
    expect(explanation()).toContain('בלי תשלום נוסף על מנות')
  })

  it('charges only the meals beyond the paid commitment', () => {
    seedBudgetV2({ event: { ...BASE, reserveAvailable: '60', reserveGuests: '50' }, expenses: EXPENSES })
    renderApp()
    // 40 covered by the minimum, 10 charged × 380 = 3,800; income 260×450 = 117,000; cost 128,800.
    expect(balance()).toContain('11,800')
    expect(summary()).toContain('250 מנות × 380 ₪ + 10 מנות רזרבה × 380')
    expect(explanation()).toContain('10 מנות בתשלום נוסף (3,800')
  })
})

describe('Reserve guests — model B (prepaid reserve)', () => {
  const PREPAID = { ...BASE, reserveModel: 'prepaid', reserveAvailable: '20', reserveMealPrice: '200' }

  it('charges every prepaid reserve meal once, and reserve guests add gifts without a second charge', () => {
    seedBudgetV2({ event: { ...PREPAID, reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    // cost 95,000 + 20×200 + 30,000 = 129,000; income 225×450 = 101,250.
    expect(balance()).toContain('27,750')
    expect(summary()).toContain('20 מנות רזרבה ששולמו מראש × 200')
    expect(summary()).toContain('5 מנות רזרבה ששולמו מראש לא ינוצלו (1,000')
    expect(explanation()).toContain('20 מנות רזרבה ששולמו מראש (4,000')
  })

  it('uses an overridden gift for reserve guests', () => {
    seedBudgetV2({ event: { ...PREPAID, reserveGuests: '15', reserveGift: '300' }, expenses: EXPENSES })
    renderApp()
    expect(balance()).toContain('30,000') // 94,500 + 15×300 − 129,000
    expect(summary()).toContain('+ 15 אורחי רזרבה × 300')
  })

  it('switching models changes the calculation immediately', async () => {
    const user = userEvent.setup()
    seedBudgetV2({ event: { ...PREPAID, reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    await user.click(screen.getByRole('radio', { name: /משלמים רק על מה שצריך/ }))
    expect(balance()).toContain('23,750') // reserve guests now sit in unused guaranteed meals
    expect(stored().event.reserveModel).toBe('as-needed')
  })
})

describe('Reserve guests — validation and scenarios', () => {
  it('flags more expected guests than reserve places and marks the summary outdated', async () => {
    const user = userEvent.setup()
    seedBudgetV2({ event: { ...BASE, reserveAvailable: '10', reserveGuests: '5' }, expenses: EXPENSES })
    renderApp()
    const guests = screen.getByLabelText('כמה מהם צפויים להגיע')
    await user.clear(guests)
    await user.type(guests, '12')
    expect(guests.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('לא יותר ממספר מקומות הרזרבה (10)')).toBeTruthy()
    expect(within(screen.getByTestId('balance')).getByText('לא מעודכן')).toBeTruthy()
  })

  it('keeps reserve guests fixed in what-if scenarios and shows them in the hint', () => {
    seedBudgetV2({ event: { ...BASE, reserveAvailable: '20', reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    fireEvent.change(screen.getByLabelText('פחות אורחים מגיעים?'), { target: { value: '80' } })
    const hint = normalize(document.getElementById('scenario-rate-hint').textContent)
    expect(hint).toContain('≈ 240 אורחים מגיעים (מתוך 300) + 15 מהרזרבה')
    // 240 base guests leave 10 of the 250 guaranteed meals spare: 10 reserve guests covered, 5 charged × 380.
    expect(normalize(screen.getByTestId('scenario-balance').textContent)).toContain('12,150') // 255×450 − (95,000 + 1,900 + 30,000)
  })
})

describe('Migration of saved budgets from the published site', () => {
  it('shows the old reserve as prepaid with identical numbers, explains it once, and remembers the dismissal', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.loss) // v1: 10 reserve meals × 200
    const legacyBefore = localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)
    const first = renderApp()
    expect(balance()).toContain('32,500')
    expect(screen.getByRole('radio', { name: /רזרבה ששולמה מראש/ }).checked).toBe(true)
    expect(screen.getByLabelText('מקומות רזרבה').value).toBe('10')
    expect(screen.getByLabelText('כמה מהם צפויים להגיע').value).toBe('')
    await user.click(screen.getByRole('button', { name: 'הבנתי' }))
    expect(screen.queryByText('עדכנו את חישוב הרזרבה')).toBeNull()
    first.unmount()

    renderApp()
    expect(screen.queryByText('עדכנו את חישוב הרזרבה')).toBeNull()
    expect(balance()).toContain('32,500')
    expect(localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)).toBe(legacyBefore) // legacy data untouched
  })

  it('shows no notice for budgets that had no reserve', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    expect(balance()).toContain('9,525')
    expect(screen.queryByText('עדכנו את חישוב הרזרבה')).toBeNull()
    expect(screen.getByText('אורחי רזרבה').closest('details').open).toBe(false)
  })
})

describe('Family gifts', () => {
  const familySection = () => screen.getByText('מתנות מהמשפחה').closest('details')
  const toggle = () => screen.getByRole('switch', { name: 'לכלול מתנות מהמשפחה בחישוב' })
  const labelInputs = () => within(screen.getByRole('list', { name: 'מתנות מהמשפחה' })).getAllByRole('textbox', { name: 'ממי המתנה' })

  async function enable(user) {
    await user.click(within(familySection()).getByText('מתנות מהמשפחה'))
    await user.click(toggle())
  }

  it('is off by default and explains how to avoid double counting', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    renderApp()
    expect(familySection().open).toBe(false)
    await user.click(within(familySection()).getByText('מתנות מהמשפחה'))
    expect(toggle().checked).toBe(false)
    expect(normalize(document.getElementById('family-warning').textContent)).toContain('אל תכללו אותן גם במתנה הממוצעת לאורח')
  })

  it('suggests the parents, and enabled gifts are added to income, balance and break-even', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    renderApp()
    await enable(user)
    expect(labelInputs().map((i) => i.value)).toEqual(['הורי הכלה', 'הורי החתן'])
    await user.type(screen.getByRole('textbox', { name: 'סכום המתנה מהורי הכלה (₪)' }), '20000')
    await user.type(screen.getByRole('textbox', { name: 'סכום המתנה מהורי החתן (₪)' }), '5000')
    expect(balance()).toContain('34,525') // 9,525 + 25,000
    expect(summary()).toContain('+ מתנות מהמשפחה 25,000')
    expect(summary()).toContain('153,775')
    expect(summary()).toContain('מתנה ממוצעת לאיזון370') // ceil((119,250 − 25,000) / 255)
    expect(summary()).toContain('(לפני מתנות המשפחה)')
    expect(normalize(document.querySelector('.family-total-value').textContent)).toContain('25,000')
  })

  it('switching off excludes the gifts but keeps them', async () => {
    const user = userEvent.setup()
    seedBudgetV2({ event: SAMPLES.profit.event, expenses: SAMPLES.profit.expenses, familyGifts: { enabled: true, items: [{ id: 'p', label: 'הורים', amount: '20,000' }] } })
    renderApp()
    expect(balance()).toContain('29,525')
    await user.click(toggle())
    expect(balance()).toContain('9,525')
    expect(screen.getByText('מתנה אחת שמורה, אבל היא לא נכללת בחישוב כרגע.')).toBeTruthy()
    expect(stored().familyGifts).toEqual({ enabled: false, items: [{ id: 'p', label: 'הורים', amount: '20,000' }] })
  })

  it('adds, edits and deletes gifts with sensible focus', async () => {
    const user = userEvent.setup()
    seedBudgetV2({ event: SAMPLES.profit.event, expenses: SAMPLES.profit.expenses, familyGifts: { enabled: true, items: [] } })
    renderApp()
    await user.click(screen.getByRole('button', { name: 'הוספת מתנה מהמשפחה' }))
    const label = labelInputs()[0]
    expect(document.activeElement).toBe(label)
    await user.type(label, 'סבא וסבתא')
    await user.type(screen.getByRole('textbox', { name: 'סכום המתנה מסבא וסבתא (₪)' }), '3000')
    expect(balance()).toContain('12,525')
    await user.click(screen.getByRole('button', { name: 'מחיקת המתנה מסבא וסבתא' }))
    expect(balance()).toContain('9,525')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'הוספת מתנה מהמשפחה' }))
  })

  it('requires a description once a gift has an amount', async () => {
    const user = userEvent.setup()
    seedBudgetV2({ event: SAMPLES.profit.event, expenses: SAMPLES.profit.expenses, familyGifts: { enabled: true, items: [{ id: 'x', label: '', amount: '' }] } })
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'סכום המתנה מללא תיאור (₪)' }), '1000')
    expect(screen.getByText('יש לכתוב ממי המתנה')).toBeTruthy()
    expect(within(screen.getByTestId('balance')).getByText('לא מעודכן')).toBeTruthy()
  })

  it('invalid amounts in switched-off gifts never block the summary', () => {
    seedBudgetV2({ event: SAMPLES.profit.event, expenses: SAMPLES.profit.expenses, familyGifts: { enabled: false, items: [{ id: 'x', label: '', amount: 'oops' }] } })
    renderApp()
    expect(balance()).toContain('9,525')
    expect(screen.queryByText('לא מעודכן')).toBeNull()
  })

  it('persists after a reload', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    const first = renderApp()
    await enable(user)
    await user.type(screen.getByRole('textbox', { name: 'סכום המתנה מהורי הכלה (₪)' }), '10000')
    first.unmount()
    renderApp()
    expect(toggle().checked).toBe(true)
    expect(balance()).toContain('19,525')
  })

  it('with only family gifts and no guests, the summary shows the result instead of the empty state', () => {
    seedBudgetV2({ expenses: [], familyGifts: { enabled: true, items: [{ id: 'p', label: 'הורים', amount: '5,000' }] } })
    renderApp()
    expect(balance()).toContain('רווח צפוי')
    expect(balance()).toContain('אין אורחים מגיעים, כך שההכנסה היא ממתנות המשפחה בלבד')
  })
})
