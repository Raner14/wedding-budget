// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber } from './format.js'

// Intl may add invisible bidi marks and non-breaking spaces depending on the ICU version.
const normalize = (s) => s.replace(/[\u200e\u200f\u061c]/g, '').replace(/[\u00a0\u202f]/g, ' ').trim()

describe('formatMoney', () => {
  it('formats whole shekels with a thousands separator and the ₪ sign', () => {
    const out = normalize(formatMoney(9525))
    expect(out).toContain('9,525')
    expect(out).toContain('₪')
  })

  it('never shows decimal places', () => {
    expect(normalize(formatMoney(119_250))).not.toMatch(/[.]\d/)
    expect(normalize(formatMoney(1_234_567))).toContain('1,234,567')
  })

  it('rounds fractional values for display', () => {
    expect(normalize(formatMoney(10.6))).toContain('11')
    expect(normalize(formatMoney(467.4))).toContain('467')
  })

  it('formats zero', () => {
    expect(normalize(formatMoney(0))).toMatch(/^(0 ₪|₪ ?0)$/)
  })
})

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(normalize(formatNumber(1234))).toBe('1,234')
    expect(normalize(formatNumber(255))).toBe('255')
  })

  it('shows no decimals', () => {
    expect(normalize(formatNumber(15.95))).toBe('16')
  })
})
