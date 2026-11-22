import { describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { normalize, SAMPLES, seedBudget } from './test/helpers.js'

const summary = () => within(document.getElementById('summary'))
const summaryText = () => normalize(document.getElementById('summary').textContent)
const balance = () => screen.getByTestId('balance')
const bar = () => document.querySelector('.mobile-bar')

describe('Budget summary — results', () => {
  it('shows the profit sample exactly as calculated', () => {
    seedBudget(SAMPLES.profit)
    render(<App />)
    expect(balance().className).toContain('tone-profit')
    expect(normalize(balance().textContent)).toContain('רווח צפוי')
    expect(normalize(balance().textContent)).toContain('9,525')
    const text = summaryText()
    expect(text).toContain('119,250') // total expenses
    expect(text).toContain('128,775') // expected gifts
    expect(text).toContain('255 אורחים × 505')
    expect(text).toContain('89,250') // venue
    expect(text).toContain('30,000') // additional
    expect(text).toContain('468') // break-even gift (ceil)
    expect(text).toContain('387') // max meal price
    expect(text).toContain('המתנה שהזנתם גבוהה ב-37')
    expect(text).toContain('הערכה בלבד')
  })

  it('shows the loss sample with minimum and reserve meals', () => {
    seedBudget(SAMPLES.loss)
    render(<App />)
    expect(balance().className).toContain('tone-loss')
    const text = summaryText()
    expect(normalize(balance().textContent)).toContain('הפסד צפוי')
    expect(normalize(balance().textContent)).toContain('32,500')
    expect(normalize(balance().textContent)).not.toContain('-') // the word, not a minus sign, conveys the loss
    expect(text).toContain('127,000')
    expect(text).toContain('94,500')
    expect(text).toContain('250 מנות × 380')
    expect(text).toContain('10 רזרבה × 200')
    expect(text).toContain('בגלל מינימום המנות תשלמו על 40 מנות שלא ינוצלו (15,200')
    expect(text).toContain('605')
    expect(text).toContain('חסרים 155 ₪ לאורח')
    expect(text).toContain('250')
  })

  it('shows the full loss and explains it when nobody attends', () => {
    seedBudget(SAMPLES.zero)
    render(<App />)
    expect(normalize(balance().textContent)).toContain('117,500')
    const text = summaryText()
    expect(text).toContain('אין אורחים מגיעים, ולכן אין הכנסה ממתנות')
    expect(text).toContain('אי אפשר לחשב עלות לאורח')
    expect(text).toContain('אין מחיר איזון')
    expect(text).toContain('ב-30,000')
  })

  it('reports "no billed meals" without a minimum or guests', () => {
    seedBudget({ event: { mealPrice: '300' }, expenses: [{ id: 'a', name: 'צלם', amount: '1000' }] })
    render(<App />)
    expect(summaryText()).toContain('אין מנות לחיוב')
  })

  it('shows an "even" balance', () => {
    seedBudget({ event: { invitedGuests: '100', attendanceRate: '100', mealPrice: '300', averageGift: '350' }, expenses: [{ id: 'a', name: 'צלם', amount: '5000' }] })
    render(<App />)
    expect(balance().className).toContain('tone-even')
    expect(normalize(balance().textContent)).toContain('מאוזן')
  })

  it('updates live while typing and changes tone from profit to loss', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    render(<App />)
    const gift = screen.getByLabelText('מתנה ממוצעת לאורח מגיע (₪)')
    await user.clear(gift)
    await user.type(gift, '400')
    expect(balance().className).toContain('tone-loss')
    expect(normalize(balance().textContent)).toContain('17,250') // 255×400 − 119,250
  })
})

describe('Budget summary — empty, error and outdated states', () => {
  it('shows a friendly empty state before anything is entered', () => {
    render(<App />)
    expect(summary().getByText('הסיפור שלכם מתחיל כאן')).toBeTruthy()
    expect(screen.queryByTestId('balance')).toBeNull()
  })

  it('shows the last valid result clearly marked as outdated while a field is invalid', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    render(<App />)
    const meal = screen.getByLabelText('מחיר למנה (₪)')
    // Append a letter: "350" → "350O" (clearing first would be a valid, empty = 0 state).
    await user.type(meal, 'O')

    expect(summary().getByText('התוצאות לא מעודכנות')).toBeTruthy()
    expect(summary().getByText(/יש לתקן שדה אחד/)).toBeTruthy()
    expect(within(balance()).getByText('לא מעודכן')).toBeTruthy()
    expect(balance().className).toContain('tone-stale')
    expect(normalize(balance().textContent)).toContain('9,525') // last valid value, labelled
    expect(within(bar()).getByText('לא מעודכן')).toBeTruthy()

    await user.clear(meal)
    await user.type(meal, '340')
    expect(screen.queryByText('לא מעודכן')).toBeNull()
    expect(balance().className).toContain('tone-profit')
  })

  it('counts multiple invalid fields', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    render(<App />)
    await user.type(screen.getByLabelText('מחיר למנה (₪)'), 'x')
    await user.type(screen.getByLabelText('מתנה ממוצעת לאורח מגיע (₪)'), 'y')
    expect(summary().getByText(/יש לתקן 2 שדות/)).toBeTruthy()
  })

  it('shows only the error (no numbers) when there is no earlier valid result', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('כמה אורחים מזמינים?'), 'abc')
    expect(summary().getByText('יש לתקן את השדות המסומנים')).toBeTruthy()
    expect(screen.queryByTestId('balance')).toBeNull()
    expect(within(bar()).getByText('יש לתקן שדות')).toBeTruthy()
  })

  it('moves focus to the first invalid field, opening the reserve section if needed', async () => {
    const user = userEvent.setup()
    seedBudget({ ...SAMPLES.profit, event: { ...SAMPLES.profit.event, reserveMeals: 'x' } })
    render(<App />)
    const details = screen.getByText('מנות רזרבה').closest('details')
    await user.click(summary().getByRole('button', { name: 'מעבר לשדה הראשון לתיקון' }))
    expect(document.activeElement).toBe(screen.getByLabelText('מנות רזרבה לחיוב'))
    expect(details.open).toBe(true)
  })
})

describe('Mobile balance bar', () => {
  it('mirrors the balance and links to the summary', () => {
    seedBudget(SAMPLES.loss)
    render(<App />)
    expect(bar().getAttribute('href')).toBe('#summary')
    expect(bar().className).toContain('tone-loss')
    expect(normalize(bar().textContent)).toContain('הפסד צפוי')
    expect(normalize(bar().textContent)).toContain('32,500')
  })

  it('invites the user to start when empty', () => {
    render(<App />)
    expect(normalize(bar().textContent)).toContain('עוד אין חישוב')
  })
})

describe('Screen reader announcement', () => {
  it('announces the balance after typing pauses', async () => {
    seedBudget(SAMPLES.profit)
    render(<App />)
    const region = document.querySelector('#summary [aria-live="polite"]')
    await act(() => new Promise((r) => setTimeout(r, 800)))
    expect(normalize(region.textContent)).toBe('רווח צפוי 9,525 שקלים')
  })
})
