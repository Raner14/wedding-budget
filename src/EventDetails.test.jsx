import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'

const LABELS = {
  invited: 'כמה אורחים מזמינים?',
  rate: 'אחוז הגעה צפוי (%)',
  mealPrice: 'מחיר למנה (₪)',
  minimum: 'מינימום מנות מובטח',
  reserveMeals: 'מנות רזרבה לחיוב',
  reservePrice: 'מחיר למנת רזרבה (₪)',
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

  it('keeps reserve meals collapsed by default and opens them when a reserve field is invalid', async () => {
    const user = userEvent.setup()
    renderApp()
    const details = screen.getByText('מנות רזרבה').closest('details')
    expect(details.open).toBe(false)
    await user.click(within(details).getByText('מנות רזרבה'))
    expect(details.open).toBe(true)
    await user.type(screen.getByLabelText(LABELS.reserveMeals), '10')
    expect(screen.getByText('יש להזין מחיר למנת רזרבה')).toBeTruthy()
    // Trying to collapse while there is an error keeps it open.
    await user.click(within(details).getByText('מנות רזרבה'))
    expect(details.open).toBe(true)
  })

  it('saves every change to localStorage', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText(LABELS.invited), '300')
    await user.type(screen.getByLabelText(LABELS.gift), '450')
    expect(stored()).toMatchObject({ version: 1, event: { invitedGuests: '300', averageGift: '450' } })
  })

  it('restores the saved form after a reload', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await user.type(screen.getByLabelText(LABELS.invited), '300')
    await user.type(screen.getByLabelText(LABELS.reserveMeals), '10')
    await user.type(screen.getByLabelText(LABELS.reservePrice), '200')
    first.unmount()

    renderApp()
    expect(screen.getByLabelText(LABELS.invited).value).toBe('300')
    expect(screen.getByLabelText(LABELS.reservePrice).value).toBe('200')
    expect(screen.getByText('מנות רזרבה').closest('details').open).toBe(true)
    expect(attendingText()).toContain('255')
  })

  it('shows the error for invalid data that was saved earlier, instead of silently resetting it', () => {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify({
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
})
