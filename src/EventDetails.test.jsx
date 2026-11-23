import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { BUDGET_STORAGE_KEY, LEGACY_BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'
import { normalize, SAMPLES, seedBudget } from './test/helpers.js'

const LABELS = {
  invited: 'כמה אורחים מזמינים?',
  rate: 'אחוז הגעה צפוי (%)',
  mealPrice: 'מחיר למנה (₪)',
  minimum: 'מינימום מנות מובטח',
  reservePlaces: 'כמה מקומות רזרבה?',
  reserveGuests: 'כמה צפויים להגיע?',
  reservePrice: 'מחיר למנת רזרבה (₪)',
  reserveGift: 'מתנה מאורח רזרבה (₪)',
  gift: 'מתנה ממוצעת לאורח מגיע (₪)',
}

const stored = () => JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY))
const attendingText = () => screen.getByText(/צפויים לחגוג איתכם/).textContent

describe('Event details form', () => {
  it('exposes every approved input with an accessible Hebrew label', () => {
    renderApp()
    for (const label of Object.values(LABELS)) expect(screen.getByLabelText(label)).toBeTruthy()
  })

  it('starts with an illustrative 85% attendance rate and explains it', () => {
    renderApp()
    const rate = screen.getByLabelText(LABELS.rate)
    expect(rate.value).toBe('85')
    const help = document.getElementById(rate.getAttribute('aria-describedby'))
    expect(help.textContent).toContain('להמחשה בלבד')
  })

  it('updates the expected attending guests while typing', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText(LABELS.invited), '300')
    expect(attendingText()).toContain('255')
    await user.clear(screen.getByLabelText(LABELS.rate))
    await user.type(screen.getByLabelText(LABELS.rate), '70')
    expect(attendingText()).toContain('210')
  })

  it('shows a field error for invalid input and clears it once fixed', async () => {
    const user = userEvent.setup()
    renderApp()
    const meal = screen.getByLabelText(LABELS.mealPrice)
    await user.type(meal, '12א')
    expect(meal.getAttribute('aria-invalid')).toBe('true')
    const describedBy = meal.getAttribute('aria-describedby').split(' ')
    const errorEl = describedBy.map((id) => document.getElementById(id)).find((el) => el?.classList.contains('error'))
    expect(errorEl.textContent).toContain('יש להזין מספר שלם')
    // The help text stays linked alongside the error.
    expect(describedBy).toContain('field-mealPrice-help')

    await user.clear(meal)
    await user.type(meal, '350')
    expect(meal.getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText(/יש להזין מספר שלם/)).toBeNull()
  })

  it('rejects an attendance rate above 100%', async () => {
    const user = userEvent.setup()
    renderApp()
    const rate = screen.getByLabelText(LABELS.rate)
    await user.clear(rate)
    await user.type(rate, '120')
    expect(screen.getByText('אחוז ההגעה צריך להיות בין 0 ל-100')).toBeTruthy()
    expect(attendingText()).toContain('—')
  })

  it('formats amounts with thousands separators on blur, but never the percentage', async () => {
    const user = userEvent.setup()
    renderApp()
    const meal = screen.getByLabelText(LABELS.mealPrice)
    await user.type(meal, '15000')
    await user.tab()
    expect(meal.value).toBe('15,000')
    const rate = screen.getByLabelText(LABELS.rate)
    await user.clear(rate)
    await user.type(rate, '90')
    await user.tab()
    expect(rate.value).toBe('90')
  })

  it('keeps reserves collapsed by default and open while a reserve field is invalid', async () => {
    const user = userEvent.setup()
    renderApp()
    const details = screen.getByText('רזרבות').closest('details')
    expect(details.open).toBe(false)
    expect(normalize(details.querySelector('summary').textContent)).toContain('משלמים רק על מי שמגיע')
    await user.click(within(details).getByText('רזרבות'))
    expect(details.open).toBe(true)
    await user.type(screen.getByLabelText(LABELS.reservePlaces), '5')
    await user.type(screen.getByLabelText(LABELS.reserveGuests), '8')
    expect(screen.getByText('לא יותר ממספר מקומות הרזרבה (5)')).toBeTruthy()
    // Trying to collapse while there is an error keeps it open.
    await user.click(within(details).getByText('רזרבות'))
    expect(details.open).toBe(true)
  })

  it('saves every change to localStorage', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText(LABELS.invited), '300')
    await user.type(screen.getByLabelText(LABELS.gift), '450')
    expect(stored()).toMatchObject({ version: 3, event: { invitedGuests: '300', averageGift: '450' } })
  })

  it('restores the saved form after a reload', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await user.type(screen.getByLabelText(LABELS.invited), '300')
    await user.type(screen.getByLabelText(LABELS.reservePlaces), '10')
    await user.type(screen.getByLabelText(LABELS.reserveGuests), '4')
    await user.click(screen.getByText('הגדרות מתקדמות'))
    await user.type(screen.getByLabelText(LABELS.reservePrice), '200')
    first.unmount()

    renderApp()
    expect(screen.getByLabelText(LABELS.invited).value).toBe('300')
    expect(screen.getByLabelText(LABELS.reservePrice).value).toBe('200')
    expect(screen.queryByRole('radio')).toBeNull() // no billing model selector any more
    expect(screen.getByText('רזרבות').closest('details').open).toBe(true)
    expect(screen.getByText('הגדרות מתקדמות').closest('details').open).toBe(true) // an override is set
    expect(attendingText()).toContain('259') // 255 + 4 reserve guests
    expect(attendingText()).toContain('כולל 4 מהרזרבה')
  })

  it('shows the error for invalid data that was saved earlier, instead of silently resetting it', () => {
    localStorage.setItem(LEGACY_BUDGET_STORAGE_KEY, JSON.stringify({
      version: 1,
      event: { invitedGuests: '300', attendanceRate: '85', mealPrice: '35O' },
      expenses: [],
    }))
    renderApp()
    const meal = screen.getByLabelText(LABELS.mealPrice)
    expect(meal.value).toBe('35O')
    expect(meal.getAttribute('aria-invalid')).toBe('true')
  })

  it('recovers from corrupted saved data', () => {
    localStorage.setItem(BUDGET_STORAGE_KEY, '{broken')
    renderApp()
    expect(screen.getByLabelText(LABELS.invited).value).toBe('')
    expect(screen.getByLabelText(LABELS.rate).value).toBe('85')
  })

  // Regression: "350,5" used to be read as 3,505 (separators were stripped anywhere).
  it('rejects a decimal comma instead of silently multiplying the price', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    renderApp()
    const meal = screen.getByLabelText(LABELS.mealPrice)
    await user.clear(meal)
    await user.type(meal, '350,5')
    await user.tab()
    expect(meal.value).toBe('350,5') // not reformatted to "3,505"
    expect(meal.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('יש להזין מספר שלם, למשל 15,000')).toBeTruthy()
    expect(normalize(document.querySelector('.venue-row .venue-amount').textContent)).toBe('—')
    expect(normalize(document.getElementById('summary').textContent)).not.toContain('3,505')
  })
})
