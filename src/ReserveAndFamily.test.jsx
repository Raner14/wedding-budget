import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { normalize, SAMPLES, seedBudget, seedBudgetCurrent, seedBudgetV2 } from './test/helpers.js'
import { BUDGET_STORAGE_KEY, LEGACY_BUDGET_STORAGE_KEY, PREVIOUS_BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'

const EXPENSES = [{ id: 'all', name: 'הוצאות', amount: '30,000' }]
// 300 invited × 70% = 210 guests; minimum 250 → 40 guaranteed meals paid but unused.
const BASE = { invitedGuests: '300', attendanceRate: '70', mealPrice: '380', minimumMeals: '250', averageGift: '450' }

const balance = () => normalize(screen.getByTestId('balance').textContent)
const summary = () => normalize(document.getElementById('summary').textContent)
const breakdown = () => normalize(document.querySelector('.reserve-breakdown')?.textContent)
const attendingText = () => normalize(screen.getByText(/צפויים לחגוג איתכם/).closest('p').textContent)
const stored = () => JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY))
const reserveSection = () => screen.getByText('רזרבות').closest('details')

describe('Reserves — simple UI', () => {
  it('shows a titled section with only two primary fields and no billing model choice', async () => {
    const user = userEvent.setup()
    renderApp()
    const section = reserveSection()
    expect(normalize(section.querySelector('summary').textContent)).toContain('משלמים רק על מי שמגיע')
    await user.click(within(section).getByText('רזרבות'))
    expect(screen.getByLabelText('כמה מקומות רזרבה?')).toBeTruthy()
    expect(screen.getByLabelText('כמה צפויים להגיע?')).toBeTruthy()
    expect(within(section).queryByRole('radio')).toBeNull()
    // Overrides live under a collapsed "advanced settings".
    expect(screen.getByText('הגדרות מתקדמות').closest('details').open).toBe(false)
  })

  it('shows the regular meal price and average gift as the defaults of the overrides', () => {
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '10' }, expenses: EXPENSES })
    renderApp()
    expect(normalize(screen.getByLabelText('מחיר למנת רזרבה (₪)').getAttribute('placeholder'))).toBe('כמו מנה רגילה (380 ₪)')
    expect(normalize(screen.getByLabelText('מתנה מאורח רזרבה (₪)').getAttribute('placeholder'))).toBe('כמו המתנה הממוצעת (450 ₪)')
  })
})

describe('Reserves — only those who come are paid for', () => {
  it('zero reserve attendees: no cost, no gifts, the balance is unchanged', () => {
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '20', reserveGuests: '0' }, expenses: EXPENSES })
    renderApp()
    expect(balance()).toContain('30,500') // 210×450 − (250×380 + 30,000), as without reserves
    expect(screen.getByText('כל עוד אף אחד מהרזרבה לא מגיע, אין עלות נוספת ואין מתנות נוספות.')).toBeTruthy()
  })

  it('reserve guests first fill unused guaranteed meals: more gifts, no extra meal cost', () => {
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '20', reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    expect(attendingText()).toContain('≈ 225 אורחים')
    expect(attendingText()).toContain('כולל 15 מהרזרבה')
    expect(balance()).toContain('23,750') // 225×450 − 125,000
    expect(breakdown()).toContain('עלות מנות רזרבה15 במנות מובטחות שכבר שולמו0 ₪')
    expect(breakdown()).toContain('מתנות נוספות15 אורחים × 450 ₪6,750 ₪')
    expect(breakdown()).toContain('תוספת למאזן6,750 ₪')
    expect(summary()).toContain('+ 15 אורחי רזרבה × 450')
  })

  it('charges only the meals beyond the paid commitment, and shows the net impact', () => {
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '60', reserveGuests: '50' }, expenses: EXPENSES })
    renderApp()
    // 40 covered by the minimum, 10 charged × 380 = 3,800; gifts 50 × 450 = 22,500 → +18,700.
    expect(balance()).toContain('11,800')
    expect(breakdown()).toContain('10 מנות × 380 ₪ · 40 במנות מובטחות שכבר שולמו3,800 ₪')
    expect(breakdown()).toContain('22,500')
    expect(breakdown()).toContain('תוספת למאזן18,700 ₪')
    expect(summary()).toContain('250 מנות × 380 ₪ + 10 מנות רזרבה × 380')
  })

  it('uses overrides from the advanced settings, and can show a negative net impact', () => {
    seedBudgetCurrent({ event: { ...BASE, minimumMeals: '', reserveAvailable: '10', reserveGuests: '10', reserveMealPrice: '500', reserveGift: '300' }, expenses: EXPENSES })
    renderApp()
    expect(screen.getByText('הגדרות מתקדמות').closest('details').open).toBe(true)
    // 10 × 500 = 5,000 cost; 10 × 300 = 3,000 gifts → −2,000.
    expect(breakdown()).toContain('הפחתה מהמאזן2,000 ₪')
    expect(document.querySelector('.rb-net').className).toContain('tone-loss')
  })

  it('updates the breakdown live while typing', async () => {
    const user = userEvent.setup()
    seedBudgetCurrent({ event: { ...BASE, minimumMeals: '', reserveAvailable: '10' }, expenses: EXPENSES })
    renderApp()
    await user.type(screen.getByLabelText('כמה צפויים להגיע?'), '4')
    expect(breakdown()).toContain('4 מנות × 380 ₪1,520 ₪')
    expect(breakdown()).toContain('תוספת למאזן280 ₪') // 4×450 − 4×380
  })
})

describe('Reserves — validation and scenarios', () => {
  it('flags more expected guests than reserve places and marks the summary outdated', async () => {
    const user = userEvent.setup()
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '10', reserveGuests: '5' }, expenses: EXPENSES })
    renderApp()
    const guests = screen.getByLabelText('כמה צפויים להגיע?')
    await user.clear(guests)
    await user.type(guests, '12')
    expect(guests.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('לא יותר ממספר מקומות הרזרבה (10)')).toBeTruthy()
    expect(within(screen.getByTestId('balance')).getByText('לא מעודכן')).toBeTruthy()
  })

  it('opens the advanced settings when an override is invalid', () => {
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '10', reserveMealPrice: '3x0' }, expenses: EXPENSES })
    renderApp()
    expect(screen.getByText('הגדרות מתקדמות').closest('details').open).toBe(true)
    expect(screen.getByLabelText('מחיר למנת רזרבה (₪)').getAttribute('aria-invalid')).toBe('true')
  })

  it('keeps reserve guests fixed in what-if scenarios and shows them in the hint', () => {
    seedBudgetCurrent({ event: { ...BASE, reserveAvailable: '20', reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    fireEvent.change(screen.getByLabelText('פחות אורחים מגיעים?'), { target: { value: '80' } })
    expect(normalize(document.getElementById('scenario-rate-hint').textContent)).toContain('≈ 240 אורחים מגיעים (מתוך 300) + 15 מהרזרבה')
    // 240 base guests leave 10 spare guaranteed meals: 10 reserve guests covered, 5 charged × 380.
    expect(normalize(screen.getByTestId('scenario-balance').textContent)).toContain('12,150')
  })
})

describe('Migration of budgets saved by the published site', () => {
  it('v1 reserve meals: explains the removed prepaid cost, and "add as expense" restores the old numbers', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.legacyReserve) // v1: 10 reserve meals × 200
    const legacyBefore = localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)
    renderApp()
    expect(reserveSection().open).toBe(true)
    expect(screen.getByText('שינינו את חישוב הרזרבות')).toBeTruthy()
    const note = normalize(screen.getByText('שינינו את חישוב הרזרבות').closest('.alert').textContent)
    expect(note).toContain('10 מנות רזרבה ששולמו מראש (2,000 ₪)')
    expect(note).toContain('הוסיפו 2,000 ₪ כהוצאה')
    expect(balance()).toContain('30,500') // without the old reserve cost
    expect(screen.getByLabelText('כמה מקומות רזרבה?').value).toBe('10')

    await user.click(screen.getByRole('button', { name: 'הוספה כהוצאה' }))
    expect(balance()).toContain('32,500') // exactly as published
    expect(screen.getByRole('textbox', { name: 'סכום עבור מנות רזרבה ששולמו מראש (₪)' }).value).toBe('2,000')
    expect(screen.queryByText('שינינו את חישוב הרזרבות')).toBeNull()
    expect(stored().notices.prepaidReserve).toBeNull()
    expect(localStorage.getItem(LEGACY_BUDGET_STORAGE_KEY)).toBe(legacyBefore)
  })

  it('"הבנתי, בלי הוצאה" closes the notice for good without adding anything', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.legacyReserve)
    const first = renderApp()
    await user.click(screen.getByRole('button', { name: 'הבנתי, בלי הוצאה' }))
    expect(screen.queryByText('שינינו את חישוב הרזרבות')).toBeNull()
    expect(balance()).toContain('30,500')
    first.unmount()
    renderApp()
    expect(screen.queryByText('שינינו את חישוב הרזרבות')).toBeNull()
  })

  it('v2 prepaid reserve with guests: places and guests are kept, the notice offers the exact difference', () => {
    // 270 base guests (90%), minimum 250: no spare guaranteed meals; 15 of 20 prepaid places used.
    seedBudgetV2({ event: { ...BASE, attendanceRate: '90', reserveModel: 'prepaid', reserveAvailable: '20', reserveGuests: '15', reserveMealPrice: '200' }, expenses: EXPENSES })
    const v2Before = localStorage.getItem(PREVIOUS_BUDGET_STORAGE_KEY)
    renderApp()
    expect(screen.getByLabelText('כמה צפויים להגיע?').value).toBe('15')
    const note = normalize(screen.getByText('שינינו את חישוב הרזרבות').closest('.alert').textContent)
    expect(note).toContain('20 מנות רזרבה ששולמו מראש (4,000 ₪)')
    expect(note).toContain('הוסיפו 1,000 ₪ כהוצאה') // 4,000 − 15 × 200 already charged now
    expect(localStorage.getItem(PREVIOUS_BUDGET_STORAGE_KEY)).toBe(v2Before)
  })

  it('v2 "as needed" budgets and budgets without reserves show no notice', () => {
    seedBudgetV2({ event: { ...BASE, reserveAvailable: '20', reserveGuests: '15' }, expenses: EXPENSES })
    renderApp()
    expect(balance()).toContain('23,750')
    expect(screen.queryByText('שינינו את חישוב הרזרבות')).toBeNull()
  })

  it('shows no notice for v1 budgets that had no reserve', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    expect(balance()).toContain('9,525')
    expect(screen.queryByText('שינינו את חישוב הרזרבות')).toBeNull()
    expect(reserveSection().open).toBe(false)
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
