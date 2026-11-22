import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import AnimatedMoney from './AnimatedMoney.jsx'
import { normalize } from '../test/helpers.js'

const amount = (container) => Number(normalize(container.textContent).replace(/[^\d-]/g, ''))

/** Simulates a browser that allows motion, with manually driven animation frames. */
function enableMotion() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  const callbacks = new Map()
  let nextId = 1
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { callbacks.set(nextId, cb); return nextId++ })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => callbacks.delete(id))
  return {
    /** Runs one frame with the given timestamp. */
    frame(now) {
      const pending = [...callbacks.values()]
      callbacks.clear()
      act(() => pending.forEach((cb) => cb(now)))
    },
  }
}

describe('AnimatedMoney', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    delete window.matchMedia
  })

  it('shows the exact value immediately without motion support (tests, reduced motion)', () => {
    const { container, rerender } = render(<AnimatedMoney value={9525} />)
    expect(amount(container)).toBe(9525)
    rerender(<AnimatedMoney value={-1} />)
    expect(amount(container)).toBe(-1)
  })

  it('shows an em dash for null', () => {
    const { container } = render(<AnimatedMoney value={null} />)
    expect(container.textContent).toBe('—')
  })

  it('never shows a value outside the old→new range, even when the first frame timestamp is earlier', () => {
    const frames = enableMotion()
    const { container, rerender } = render(<AnimatedMoney value={0} />)
    rerender(<AnimatedMoney value={89250} />)
    // rAF timestamps are the frame START time, which can precede the clock reading taken when
    // the animation was scheduled (performance.now() is 0 here under fake timers).
    for (const now of [-40, -20, 100, 300, 500]) {
      frames.frame(now)
      const v = amount(container)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(89250)
    }
    frames.frame(700)
    expect(amount(container)).toBe(89250)
  })

  it('settles on the exact final value even if animation frames never run (throttled tab)', () => {
    enableMotion() // frames are captured but never executed
    const { container, rerender } = render(<AnimatedMoney value={0} />)
    rerender(<AnimatedMoney value={9525} />)
    act(() => vi.advanceTimersByTime(800))
    expect(amount(container)).toBe(9525)
  })

  it('animates downward to the exact new value', () => {
    const frames = enableMotion()
    const { container, rerender } = render(<AnimatedMoney value={0} />)
    act(() => vi.advanceTimersByTime(800))
    rerender(<AnimatedMoney value={500} />)
    act(() => vi.advanceTimersByTime(800))
    rerender(<AnimatedMoney value={120} />)
    frames.frame(0)
    frames.frame(300)
    const mid = amount(container)
    expect(mid).toBeGreaterThanOrEqual(120)
    expect(mid).toBeLessThanOrEqual(500)
    frames.frame(700)
    expect(amount(container)).toBe(120)
  })
})
