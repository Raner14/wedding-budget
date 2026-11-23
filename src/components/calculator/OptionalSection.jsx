import { useState } from 'react'
import Icon from '../Icon.jsx'

/**
 * Collapsible "(אופציונלי)" section built on <details>.
 * `forceOpen` keeps it open while it contains an error: React would not re-open it
 * (its `open` prop stays true), so the collapse click itself is blocked.
 *
 * @param {{ title: string, defaultOpen?: boolean, forceOpen?: boolean, className?: string, children: React.ReactNode }} props
 */
export default function OptionalSection({ title, defaultOpen = false, forceOpen = false, className = '', children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details className={`optional-section ${className}`.trim()} open={open || forceOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary
        onClick={(e) => {
          if (forceOpen) e.preventDefault()
        }}
      >
        <Icon name="chevron" className="chev" strokeWidth={2} />
        {title} <span className="opt">(אופציונלי)</span>
      </summary>
      <div className="optional-body">{children}</div>
    </details>
  )
}
