import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'
import { normalize, SAMPLES, seedBudget } from './test/helpers.js'

const slider = (label) => screen.getByLabelText(label)
const MEAL = 'המנה מתייקרת?'
const RATE = 'פחות אורחים מגיעים?'
const GIFT = 'המתנות משתנות?'
const move = (label, value) => fireEvent.change(slider(label), { target: { value: String(value) } })
const scenario = () => normalize(screen.getByTestId('scenario-balance').textContent)
const diff = () => normalize(screen.getByTestId('scenario-diff').textContent)
const hint = (label) => normalize(document.getElementById(`${slider(label).id}-hint`).textContent)

describe('What-if scenarios', () => {
  it('starts neutral: the scenario equals the current balance', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    expect(scenario()).toContain('רווח צפוי')
    expect(scenario()).toContain('9,525')
    expect(diff()).toContain('ללא שינוי')
    expect(screen.getByRole('button', { name: 'איפוס תרחיש' }).disabled).toBe(true)
  })

  it('meal price +10%: 350 → 385, venue 98,175, balance +600 (−8,925)', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    move(MEAL, 10)
    expect(hint(MEAL)).toContain('385')
    expect(scenario()).toContain('רווח צפוי')
    expect(scenario()).toContain('600')
    expect(diff()).toContain('ירידה של')
    expect(diff()).toContain('8,925')
    expect(slider(MEAL).getAttribute('aria-valuetext')).toBe('עלייה של 10 אחוזים במחיר המנה')
  })

  it('applies the meal change to reserve meals too', () => {
    seedBudget(SAMPLES.loss)
    renderApp()
    move(MEAL, 10)
    expect(hint(MEAL)).toContain('418')
    expect(hint(MEAL)).toContain('רזרבה: 220')
    // 250×418 + 10×220 + 30,000 = 136,700 ; gifts 94,500 → −42,200 ; diff −9,700
    expect(scenario()).toContain('42,200')
    expect(diff()).toContain('9,700')
  })

  it('attendance 70%: 210 guests, the 250 minimum is billed, balance −11,450', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    move(RATE, 70)
    expect(hint(RATE)).toContain('≈ 210 אורחים מגיעים (מתוך 300)')
    expect(scenario()).toContain('הפסד צפוי')
    expect(scenario()).toContain('11,450')
    expect(diff()).toContain('20,975')
  })

  it('average gift −10%: 505 → 455 (half rounds up), balance −3,225', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    move(GIFT, -10)
    expect(hint(GIFT)).toContain('455')
    expect(scenario()).toContain('הפסד צפוי')
    expect(scenario()).toContain('3,225')
    expect(diff()).toContain('12,750')
  })

  it('combines all three adjustments', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    move(MEAL, 20) // 420
    move(RATE, 90) // 270 guests
    move(GIFT, 10) // 556 (555.5 → 556)
    // 270×420 + 30,000 = 143,400 ; gifts 270×556 = 150,120 → +6,720
    expect(scenario()).toContain('רווח צפוי')
    expect(scenario()).toContain('6,720')
  })

  it('never changes the entered data or what is saved', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    const savedBefore = localStorage.getItem(BUDGET_STORAGE_KEY)
    move(MEAL, 30)
    move(RATE, 50)
    move(GIFT, -30)
    expect(screen.getByLabelText('מחיר למנה (₪)').value).toBe('350')
    expect(screen.getByLabelText('אחוז הגעה צפוי (%)').value).toBe('85')
    expect(normalize(screen.getByTestId('balance').textContent)).toContain('9,525')
    expect(localStorage.getItem(BUDGET_STORAGE_KEY)).toBe(savedBefore)
  })

  it('resets the scenario', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    renderApp()
    move(MEAL, 10)
    move(RATE, 60)
    await user.click(screen.getByRole('button', { name: 'איפוס תרחיש' }))
    expect(slider(MEAL).value).toBe('0')
    expect(slider(RATE).value).toBe('85')
    expect(diff()).toContain('ללא שינוי')
  })

  it('follows the entered attendance until the user moves the slider', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    renderApp()
    const rate = screen.getByLabelText('אחוז הגעה צפוי (%)')
    await user.clear(rate)
    await user.type(rate, '90')
    expect(slider(RATE).value).toBe('90')
    expect(diff()).toContain('ללא שינוי')
  })

  it('uses the exact entered rate below the slider minimum (no phantom difference)', () => {
    seedBudget({ ...SAMPLES.profit, event: { ...SAMPLES.profit.event, attendanceRate: '40' } })
    renderApp()
    expect(slider(RATE).value).toBe('50') // the thumb is clamped to the slider range…
    expect(diff()).toContain('ללא שינוי') // …but the scenario uses 40%
  })

  it('is disabled with an explanation while fields are invalid or empty', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(screen.getByText('הזינו פרטי אירוע כדי לבחון תרחישים.')).toBeTruthy()
    expect(slider(MEAL).disabled).toBe(true)
    await user.type(screen.getByLabelText('כמה אורחים מזמינים?'), 'x')
    expect(screen.getByText('יש לתקן את השדות המסומנים כדי לבחון תרחישים.')).toBeTruthy()
    expect(slider(GIFT).disabled).toBe(true)
  })
})
