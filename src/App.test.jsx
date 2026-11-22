import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderApp } from './test/renderApp.jsx'

describe('App shell', () => {
  it('renders the Hebrew main heading', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('מתחתנים בראש שקט')
  })
})

describe('Hero', () => {
  it('shows the couple photo with Hebrew alt text and responsive sources', () => {
    renderApp()
    const img = screen.getByRole('img', { name: /הזוג שמאחורי האתר/ })
    expect(img.getAttribute('src')).toBe('/images/couple-1280.jpg')
    expect(img.getAttribute('srcset')).toContain('/images/couple-640.jpg 640w')
    expect(img.getAttribute('srcset')).toContain('/images/couple-1672.jpg 1672w')
    expect(img.getAttribute('width')).toBe('1672')
    expect(img.getAttribute('height')).toBe('941')
  })

  it('falls back to a decorative placeholder when the photo cannot load', () => {
    renderApp()
    fireEvent.error(screen.getByRole('img', { name: /הזוג שמאחורי האתר/ }))
    expect(screen.queryByRole('img', { name: /הזוג שמאחורי האתר/ })).toBeNull()
    expect(screen.getByText('התמונה שלנו')).toBeTruthy()
  })

  it('links the call to action to the calculator', () => {
    renderApp()
    const cta = screen.getByRole('link', { name: 'בואו נחשב את החתונה שלנו' })
    expect(cta.getAttribute('href')).toBe('#calculator')
  })

  it('is visible without IntersectionObserver (no hidden content in tests or old browsers)', () => {
    const { container } = renderApp()
    const reveals = container.querySelectorAll('.reveal')
    expect(reveals.length).toBeGreaterThan(0)
    reveals.forEach((el) => expect(el.classList.contains('is-visible')).toBe(true))
  })
})

describe('index.html', () => {
  const html = readFileSync(resolve(cwd(), 'index.html'), 'utf8')

  it('declares Hebrew RTL on the root element', () => {
    expect(html).toMatch(/<html lang="he" dir="rtl">/)
  })

  it('loads the approved font families', () => {
    expect(html).toContain('family=Frank+Ruhl+Libre')
    expect(html).toContain('family=Heebo')
  })
})
