import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/format.js'
import { prefersReducedMotion } from './motion.js'

const DURATION_MS = 650

/**
 * A shekel amount that counts smoothly to its new value. The final displayed value
 * is always exact. With reduced motion (or no matchMedia, e.g. tests) it updates instantly.
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
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(from + (value - from) * eased)
      currentRef.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])

  const display = reduced || value === null ? value : shown
  return (
    <bdi className={className} id={id}>
      {display === null ? '—' : formatMoney(display)}
    </bdi>
  )
}
