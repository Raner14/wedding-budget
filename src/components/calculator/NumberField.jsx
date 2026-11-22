import Icon from '../Icon.jsx'
import { formatWholeInput } from '../../lib/validation.js'

/**
 * Labelled whole-number input. Uses type="text" + inputMode="numeric" instead of
 * type="number" (no accidental scroll-wheel changes, accepts "15,000", keeps the
 * raw text so invalid input can be shown with an error instead of being dropped).
 *
 * @param {{
 *   id: string, label: string, value: string, onChange: (value: string) => void,
 *   unit?: string, help?: string, helpId?: string, error?: string, placeholder?: string,
 *   formatOnBlur?: boolean,
 * }} props
 * `helpId` lets several fields share one visible help paragraph.
 */
export default function NumberField({ id, label, value, onChange, unit, help, helpId, error, placeholder, formatOnBlur = true }) {
  const ownHelpId = help ? `${id}-help` : null
  const errorId = `${id}-error`
  const describedBy = [ownHelpId ?? helpId, error ? errorId : null].filter(Boolean).join(' ') || undefined

  function handleBlur() {
    if (!formatOnBlur) return
    const formatted = formatWholeInput(value)
    if (formatted !== value) onChange(formatted)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap${error ? ' is-invalid' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
        />
        {unit && <span className="unit" aria-hidden="true">{unit}</span>}
      </div>
      {help && <p className="help" id={ownHelpId}>{help}</p>}
      {error && (
        <p className="error" id={errorId}>
          <Icon name="alert" strokeWidth={2} />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
