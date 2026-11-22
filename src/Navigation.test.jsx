import { describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import { renderApp } from './test/renderApp.jsx'
import { SAMPLES, seedBudget } from './test/helpers.js'

const nav = () => within(screen.getByRole('navigation', { name: 'ניווט ראשי' }))
const h1 = () => screen.getByRole('heading', { level: 1 })

describe('Navigation', () => {
  it('shows the calculator at "/" and marks it as the current page', () => {
    renderApp('/')
    expect(h1().textContent).toBe('מתחתנים בראש שקט')
    expect(nav().getByRole('link', { name: 'מחשבון חתונה' }).getAttribute('aria-current')).toBe('page')
    expect(nav().getByRole('link', { name: 'המשימות שלנו' }).getAttribute('aria-current')).toBeNull()
    expect(document.title).toBe('מתחתנים בראש שקט · מחשבון תקציב חתונה')
  })

  it('opens the tasks page directly from its URL', () => {
    renderApp('/tasks')
    expect(h1().textContent).toContain('המשימות שלנו')
    expect(nav().getByRole('link', { name: 'המשימות שלנו' }).getAttribute('aria-current')).toBe('page')
    expect(document.title).toBe('המשימות שלנו · מתחתנים בראש שקט')
  })

  it('shows a friendly page for unknown URLs', () => {
    renderApp('/no-such-page')
    expect(h1().textContent).toBe('הדף הזה לא נמצא')
    expect(screen.getByRole('link', { name: 'למחשבון החתונה' }).getAttribute('href')).toBe('/')
    expect(document.title).toContain('הדף לא נמצא')
  })

  it('switches pages without reloading and moves focus to the new heading', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.click(nav().getByRole('link', { name: 'המשימות שלנו' }))
    expect(h1().textContent).toContain('המשימות שלנו')
    expect(document.activeElement).toBe(h1())
    expect(document.title).toBe('המשימות שלנו · מתחתנים בראש שקט')

    await user.click(nav().getByRole('link', { name: 'מחשבון חתונה' }))
    expect(h1().textContent).toBe('מתחתנים בראש שקט')
    expect(document.activeElement).toBe(h1())
  })

  it('keeps the calculator data when navigating away and back', async () => {
    const user = userEvent.setup()
    seedBudget(SAMPLES.profit)
    renderApp('/')
    const gift = screen.getByLabelText('מתנה ממוצעת לאורח מגיע (₪)')
    await user.clear(gift)
    await user.type(gift, '520')
    await user.click(nav().getByRole('link', { name: 'המשימות שלנו' }))
    await user.click(nav().getByRole('link', { name: 'מחשבון חתונה' }))
    expect(screen.getByLabelText('מתנה ממוצעת לאורח מגיע (₪)').value).toBe('520')
  })

  it('the brand link returns to the calculator', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await user.click(screen.getByRole('link', { name: 'מתחתנים בראש שקט — לדף הבית' }))
    expect(h1().textContent).toBe('מתחתנים בראש שקט')
  })

  it('supports the browser back and forward buttons', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/')
    render(<BrowserRouter><App /></BrowserRouter>)
    await user.click(nav().getByRole('link', { name: 'המשימות שלנו' }))
    expect(window.location.pathname).toBe('/tasks')

    act(() => window.history.back())
    await waitFor(() => expect(h1().textContent).toBe('מתחתנים בראש שקט'))
    expect(window.location.pathname).toBe('/')

    act(() => window.history.forward())
    await waitFor(() => expect(h1().textContent).toContain('המשימות שלנו'))
    window.history.replaceState(null, '', '/')
  })
})
