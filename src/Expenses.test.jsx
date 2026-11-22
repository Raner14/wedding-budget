import { describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'

const normalize = (s) => s.replace(/[\u200e\u200f]/g, '').replace(/\u00a0/g, ' ')
const list = () => screen.getByRole('list', { name: 'הוצאות נוספות' })
const rowNames = () => within(list()).getAllByRole('textbox', { name: 'שם ההוצאה' }).map((i) => i.value)
const subtotal = () => normalize(screen.getByText('סה״כ הוצאות נוספות').nextElementSibling.textContent)
/** The undo toast (sliders' <output> elements also have the implicit "status" role). */
const queryToast = () => document.querySelector('.toast')
const getToast = () => {
  const el = queryToast()
  if (!el) throw new Error('undo toast not found')
  expect(el.getAttribute('role')).toBe('status')
  return el
}
const venueAmount = () => normalize(document.querySelector('.venue-row .venue-amount').textContent)

describe('Expense management', () => {
  it('starts with DJ, photographer and wedding dress, plus the automatic venue row', () => {
    renderApp()
    expect(rowNames()).toEqual(['די-ג׳יי', 'צלם', 'שמלת כלה'])
    expect(screen.getByText('מחושב אוטומטית')).toBeTruthy()
    expect(venueAmount()).toContain('0')
  })

  it('computes the venue row automatically from the event details', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('כמה אורחים מזמינים?'), '300')
    await user.type(screen.getByLabelText('מחיר למנה (₪)'), '350')
    expect(venueAmount()).toContain('89,250') // 255 × 350
    await user.type(screen.getByLabelText('מינימום מנות מובטח'), '280')
    expect(venueAmount()).toContain('98,000') // minimum 280 × 350
  })

  it('edits names and amounts and updates the subtotal', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'סכום עבור די-ג׳יי (₪)' }), '6000')
    await user.type(screen.getByRole('textbox', { name: 'סכום עבור צלם (₪)' }), '9000')
    expect(subtotal()).toContain('15,000')

    const name = within(list()).getAllByRole('textbox', { name: 'שם ההוצאה' })[1]
    await user.clear(name)
    await user.type(name, 'צלם מגנטים')
    expect(screen.getByRole('textbox', { name: 'סכום עבור צלם מגנטים (₪)' }).value).toBe('9,000')
    expect(screen.getByRole('button', { name: 'מחיקת ההוצאה צלם מגנטים' })).toBeTruthy()
  })

  it('formats an amount with separators on blur', async () => {
    const user = userEvent.setup()
    renderApp()
    const amount = screen.getByRole('textbox', { name: 'סכום עבור שמלת כלה (₪)' })
    await user.type(amount, '12500')
    await user.tab()
    expect(normalize(amount.value)).toBe('12,500')
  })

  it('treats an empty or zero amount as "not applicable"', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'סכום עבור די-ג׳יי (₪)' }), '0')
    expect(subtotal()).toContain('0')
    expect(screen.queryByText(/יש להזין/)).toBeNull()
  })

  it('adds a custom expense, focuses its name and includes it in the subtotal', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    expect(rowNames()).toHaveLength(4)
    const newName = within(list()).getAllByRole('textbox', { name: 'שם ההוצאה' })[3]
    expect(document.activeElement).toBe(newName)
    await user.type(newName, 'הסעות')
    await user.type(screen.getByRole('textbox', { name: 'סכום עבור הסעות (₪)' }), '2000')
    expect(subtotal()).toContain('2,000')
  })

  it('requires a name once an expense has an amount', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    expect(screen.queryByText('יש להזין שם להוצאה')).toBeNull()
    await user.type(screen.getByRole('textbox', { name: 'סכום עבור ללא שם (₪)' }), '500')
    const name = within(list()).getAllByRole('textbox', { name: 'שם ההוצאה' })[3]
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('יש להזין שם להוצאה')).toBeTruthy()
  })

  it('shows an amount error and hides the subtotal while it is invalid', async () => {
    const user = userEvent.setup()
    renderApp()
    const amount = screen.getByRole('textbox', { name: 'סכום עבור צלם (₪)' })
    await user.type(amount, '9,000-')
    expect(amount.getAttribute('aria-invalid')).toBe('true')
    expect(subtotal()).toBe('—')
  })

  it('deletes an expense, moves focus, and restores it in place with undo', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'סכום עבור צלם (₪)' }), '9000')
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה צלם' }))

    expect(rowNames()).toEqual(['די-ג׳יי', 'שמלת כלה'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'מחיקת ההוצאה שמלת כלה' }))
    const toast = getToast()
    expect(toast.textContent).toContain('ההוצאה „צלם” נמחקה')
    expect(subtotal()).toContain('0')

    await user.click(within(toast).getByRole('button', { name: 'ביטול' }))
    expect(rowNames()).toEqual(['די-ג׳יי', 'צלם', 'שמלת כלה'])
    expect(screen.getByRole('textbox', { name: 'סכום עבור צלם (₪)' }).value).toBe('9,000')
    expect(document.activeElement).toBe(within(list()).getAllByRole('textbox', { name: 'שם ההוצאה' })[1])
    expect(queryToast()).toBeNull()
    expect(subtotal()).toContain('9,000')
  })

  it('moves focus to the add button after deleting the last row', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה שמלת כלה' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'הוספת הוצאה' }))
  })

  it('shows an empty state when every expense is deleted', async () => {
    const user = userEvent.setup()
    renderApp()
    for (const name of ['די-ג׳יי', 'צלם', 'שמלת כלה']) {
      await user.click(screen.getByRole('button', { name: `מחיקת ההוצאה ${name}` }))
    }
    expect(screen.queryByRole('list', { name: 'הוצאות נוספות' })).toBeNull()
    expect(screen.getByText('עוד אין הוצאות נוספות')).toBeTruthy()
  })

  it('keeps only the latest deletion undoable', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה די-ג׳יי' }))
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה צלם' }))
    expect(document.querySelectorAll('.toast')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(rowNames()).toEqual(['צלם', 'שמלת כלה'])
  })

  it('closes the toast with the close button', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה צלם' }))
    await user.click(screen.getByRole('button', { name: 'סגירת ההודעה' }))
    expect(queryToast()).toBeNull()
    expect(rowNames()).toEqual(['די-ג׳יי', 'שמלת כלה'])
  })

  it('dismisses the undo toast automatically after 6 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה צלם' }))
      act(() => vi.advanceTimersByTime(5900))
      expect(getToast()).toBeTruthy()
      act(() => vi.advanceTimersByTime(200))
      expect(queryToast()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists expense changes, including deletions and additions', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה די-ג׳יי' }))
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    await user.type(within(list()).getAllByRole('textbox', { name: 'שם ההוצאה' })[2], 'הזמנות')
    first.unmount()

    expect(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY)).expenses.map((e) => e.name)).toEqual(['צלם', 'שמלת כלה', 'הזמנות'])
    renderApp()
    expect(rowNames()).toEqual(['צלם', 'שמלת כלה', 'הזמנות'])
  })
})
