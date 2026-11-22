import { useEffect, useRef, useState } from 'react'
import { canAnimateEntrances } from './motion.js'

/**
 * Gentle fade-up entrance when the element scrolls into view.
 * Content is only hidden while the root has the `motion` class (set in main.jsx),
 * so without JS, IntersectionObserver or with reduced motion it is always visible.
 *
 * @param {{ as?: keyof JSX.IntrinsicElements, className?: string, children: React.ReactNode }} props
 */
export default function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => !canAnimateEntrances())

  useEffect(() => {
    if (visible || !ref.current) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [visible])

  return (
    <Tag ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}
