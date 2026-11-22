import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App shell', () => {
  it('renders the Hebrew main heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('מתחתנים בראש שקט')
    expect(screen.getByRole('main')).toBeTruthy()
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
