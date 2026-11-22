import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/format.js'
import { prefersReducedMotion } from './motion.js'

const DURATION_MS = 650

/**
 * A shekel amount that counts smoothly to its new value.
 *
 * Correctness guarantees (this is a financial display):
 *  - intermediate values always stay between the old and the new value (t is clamped to [0, 1]);
 *  - the exact final value is always shown: a timer settles it even when the browser throttles
 *    or pauses requestAnimationFrame (background tabs, hidden iframes);
 *  - with reduced motion (or no matchMedia, e.g. tests) it updates instantly.
 *
 * @param {{ value: number | null, className?: string, id?: string }} props
 */
export default function AnimatedMoney({ value, className, id }) {
  const reduced = prefersReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  const currentRef = useRef(reduced ? value : 0)

  useEffect(() => {
    if (reduced || value === null) {
      currentRef.current = value
      return undefined
    }
    const from = typeof currentRef.current === 'number' ? currentRef.current : 0
    if (from === value) return undefined

    let frame = 0
    let start = null
    const settle = () => {
      cancelAnimationFrame(frame)
      currentRef.current = value
      setShown(value)
    }
    const step = (now) => {
      start ??= now // measure from the first frame, never from an earlier clock reading
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_MS))
      if (t >= 1) return settle()
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(from + (value - from) * eased)
      currentRef.current = next
      setShown(next)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    const fallback = setTimeout(settle, DURATION_MS + 100)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(fallback)
    }
  }, [value, reduced])

  const display = reduced || value === null ? value : shown
  return (
    <bdi className={className} id={id}>
      {display === null ? '—' : formatMoney(display)}
    </bdi>
  )
}
