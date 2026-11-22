// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { expenseIconKey } from './expenseIcon.js'

describe('expenseIconKey', () => {
  it.each([
    ['די-ג׳יי', 'music'],
    ['דיג׳יי', 'music'],
    ['DJ', 'music'],
    ['להקה', 'music'],
    ['צלם', 'camera'],
    ['צלם מגנטים', 'camera'],
    ['וידאו', 'camera'],
    ['שמלת כלה', 'dress'],
    ['חליפת חתן', 'dress'],
    ['איפור ושיער', 'dress'],
    ['עיצוב ופרחים', 'flower'],
    ['זר כלה', 'flower'],
    ['הזמנות', 'mail'],
    ['הסעות', 'car'],
    ['רב', 'sparkle'],
    ['', 'sparkle'],
  ])('%j → %s', (name, key) => {
    expect(expenseIconKey(name)).toBe(key)
  })
})
