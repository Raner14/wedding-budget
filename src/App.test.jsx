import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderApp } from './test/renderApp.jsx'
import { FONTS_URL, loadFonts } from './fonts.js'

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
    const webp = img.closest('picture').querySelector('source[type="image/webp"]')
    expect(webp.getAttribute('srcset')).toBe(
      '/images/couple-640.webp 640w, /images/couple-960.webp 960w, /images/couple-1280.webp 1280w, /images/couple-1672.webp 1672w',
    )
    expect(webp.getAttribute('sizes')).toBe(img.getAttribute('sizes'))
  })

  it('only references image files that exist in public/ (no broken assets)', () => {
    for (const path of ['/', '/tasks']) {
      const view = renderApp(path)
      const urls = [...document.querySelectorAll('img[src], img[srcset], source[srcset]')].flatMap((el) => [
        el.getAttribute('src'),
        ...(el.getAttribute('srcset') ?? '').split(',').map((c) => c.trim().split(' ')[0]),
      ]).filter(Boolean)
      expect(urls.length).toBeGreaterThan(2)
      for (const url of urls) expect(existsSync(resolve(cwd(), 'public', url.slice(1))), `missing public${url} (${path})`).toBe(true)
      view.unmount()
    }
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

  it('preconnects to the font hosts but does not block rendering on the font stylesheet', () => {
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
    expect(html).not.toContain('fonts.googleapis.com/css2')
  })
})

describe('fonts', () => {
  it('requests only the approved families and the weights the CSS uses', () => {
    expect(FONTS_URL).toContain('family=Frank+Ruhl+Libre:wght@500;700')
    expect(FONTS_URL).toContain('family=Heebo:wght@400;500;600;700')
    expect(FONTS_URL).toContain('display=swap')
  })

  it('adds the stylesheet once', () => {
    loadFonts()
    loadFonts()
    const links = document.querySelectorAll('link[data-app-fonts]')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe(FONTS_URL)
    expect(links[0].rel).toBe('stylesheet')
    links.forEach((l) => l.remove())
  })
})
