import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'
import { isStorageAvailable } from './lib/safeStorage.js'
import { SAMPLES, seedBudget } from './test/helpers.js'

describe('Start over', () => {
  it('clears everything after confirmation and focuses the first field', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    seedBudget(SAMPLES.profit)
    renderApp()
    await user.click(screen.getByRole('button', { name: 'התחל מחדש' }))
    expect(window.confirm).toHaveBeenCalledWith('למחוק את כל הנתונים ולהתחיל מחדש?')
    const invited = screen.getByLabelText('כמה אורחים מזמינים?')
    expect(invited.value).toBe('')
    expect(screen.getByLabelText('אחוז הגעה צפוי (%)').value).toBe('85')
    expect(document.activeElement).toBe(invited)
    expect(screen.getByText('הסיפור שלכם מתחיל כאן')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY)).event.invitedGuests).toBe('')
  })

  it('keeps the data when the user cancels', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    seedBudget(SAMPLES.profit)
    renderApp()
    await user.click(screen.getByRole('button', { name: 'התחל מחדש' }))
    expect(screen.getByLabelText('כמה אורחים מזמינים?').value).toBe('300')
  })
})

describe('Storage availability', () => {
  it('detects working storage', () => {
    expect(isStorageAvailable()).toBe(true)
  })

  it('warns that data will not be kept when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(isStorageAvailable()).toBe(false)
    renderApp()
    expect(screen.getByRole('alert').textContent).toContain('הדפדפן לא מאפשר לשמור נתונים')
  })

  it('shows no warning normally', () => {
    renderApp()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Accessibility landmarks', () => {
  it('has a skip link to the main content, one h1, one banner, a main region and a footer', () => {
    renderApp()
    const skip = screen.getByRole('link', { name: 'דלגו לתוכן הראשי' })
    expect(skip.getAttribute('href')).toBe('#main-content')
    expect(screen.getByRole('main').id).toBe('main-content')
    expect(screen.getByRole('main').getAttribute('tabindex')).toBe('-1')
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'ניווט ראשי' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'המאזן שלכם' })).toBeTruthy()
  })

  it('labels every form control', () => {
    seedBudget(SAMPLES.profit)
    renderApp()
    const controls = document.querySelectorAll('main input')
    expect(controls.length).toBeGreaterThan(10)
    controls.forEach((input) => {
      const labelled = input.labels?.length > 0 || input.getAttribute('aria-label')
      expect(labelled, `unlabelled input #${input.id}`).toBeTruthy()
    })
  })
})
