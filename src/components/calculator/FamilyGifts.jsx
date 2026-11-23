import { useRef } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../Icon.jsx'
import AnimatedMoney from '../AnimatedMoney.jsx'
import OptionalSection from './OptionalSection.jsx'
import { formatNumber } from '../../lib/format.js'
import { createFamilyGift, MAX_FAMILY_GIFTS } from '../../lib/budgetState.js'
import { formatWholeInput, MAX_FAMILY_LABEL_LENGTH } from '../../lib/validation.js'
import './FamilyGifts.css'

/**
 * Optional fixed gifts from parents, grandparents or other relatives,
 * counted as income on top of the average guest gifts (only while enabled).
 *
 * @param {{
 *   familyGifts: { enabled: boolean, items: {id: string, label: string, amount: string}[] },
 *   errors: Record<string, {label?: string, amount?: string}>,
 *   total: number | null,
 *   onToggle: (enabled: boolean) => void,
 *   onAdd: (gift: object) => void,
 *   onUpdate: (id: string, patch: object) => void,
 *   onRemove: (id: string) => void,
 * }} props
 */
export default function FamilyGifts({ familyGifts, errors, total, onToggle, onAdd, onUpdate, onRemove }) {
  const { enabled, items } = familyGifts
  const listRef = useRef(null)
  const addRef = useRef(null)
  const hasError = enabled && Object.keys(errors).length > 0
  const canAdd = items.length < MAX_FAMILY_GIFTS

  function handleAdd() {
    const gift = createFamilyGift()
    flushSync(() => onAdd(gift))
    document.getElementById(`family-label-${gift.id}`)?.focus()
  }

  function handleRemove(id, index) {
    flushSync(() => onRemove(id))
    const buttons = listRef.current?.querySelectorAll('[data-role="delete-family"]') ?? []
    ;(buttons[index] ?? buttons[index - 1] ?? addRef.current)?.focus()
  }

  return (
    <OptionalSection title="מתנות מהמשפחה" className="family-section" defaultOpen={enabled || items.length > 0} forceOpen={hasError}>
      <label className="switch">
        <input type="checkbox" role="switch" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
        <span className="switch-label">לכלול מתנות מהמשפחה בחישוב</span>
      </label>

      <div className="alert alert-info family-warning" id="family-warning">
        <Icon name="info" strokeWidth={2} />
        <p>
          <strong>כדי לא לספור פעמיים:</strong> מתנות כאן נוספות למתנה הממוצעת מהאורחים. אל תכללו אותן גם במתנה הממוצעת
          לאורח, ואל תוסיפו כאן בני משפחה שכבר נספרים כאורחים עם מתנה רגילה.
        </p>
      </div>

      {enabled ? (
        <>
          {items.length > 0 ? (
            <ul className="family-list" ref={listRef} aria-label="מתנות מהמשפחה">
              {items.map((gift, index) => {
                const error = errors[gift.id] ?? {}
                const label = gift.label.trim() || 'ללא תיאור'
                return (
                  <li key={gift.id} className="family-row">
                    <div className="family-label">
                      <div className={`input-wrap${error.label ? ' is-invalid' : ''}`}>
                        <input
                          id={`family-label-${gift.id}`}
                          type="text"
                          autoComplete="off"
                          maxLength={MAX_FAMILY_LABEL_LENGTH}
                          placeholder="למשל: סבא וסבתא"
                          aria-label="ממי המתנה"
                          aria-invalid={error.label ? 'true' : undefined}
                          aria-describedby={error.label ? `family-label-${gift.id}-error` : undefined}
                          value={gift.label}
                          onChange={(e) => onUpdate(gift.id, { label: e.target.value })}
                        />
                      </div>
                      {error.label && <p className="error" id={`family-label-${gift.id}-error`}><Icon name="alert" strokeWidth={2} /><span>{error.label}</span></p>}
                    </div>
                    <div className="family-amount">
                      <div className={`input-wrap${error.amount ? ' is-invalid' : ''}`}>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          aria-label={`סכום המתנה מ${label} (₪)`}
                          aria-invalid={error.amount ? 'true' : undefined}
                          aria-describedby={error.amount ? `family-amount-${gift.id}-error` : undefined}
                          value={gift.amount}
                          onChange={(e) => onUpdate(gift.id, { amount: e.target.value })}
                          onBlur={(e) => {
                            const formatted = formatWholeInput(e.target.value)
                            if (formatted !== e.target.value) onUpdate(gift.id, { amount: formatted })
                          }}
                        />
                        <span className="unit" aria-hidden="true">₪</span>
                      </div>
                      {error.amount && <p className="error" id={`family-amount-${gift.id}-error`}><Icon name="alert" strokeWidth={2} /><span>{error.amount}</span></p>}
                    </div>
                    <button
                      type="button"
                      className="icon-btn danger"
                      data-role="delete-family"
                      aria-label={`מחיקת המתנה מ${label}`}
                      onClick={() => handleRemove(gift.id, index)}
                    >
                      <Icon name="trash" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="help">עוד אין מתנות מהמשפחה. הוסיפו את הראשונה.</p>
          )}
          <button type="button" className="btn btn-dashed family-add" ref={addRef} onClick={handleAdd} disabled={!canAdd}>
            <span className="plus" aria-hidden="true"><Icon name="plus" strokeWidth={2.4} /></span>
            הוספת מתנה מהמשפחה
          </button>
          <div className="family-total">
            <span>סה״כ מתנות מהמשפחה</span>
            <AnimatedMoney className="family-total-value" value={total} />
          </div>
        </>
      ) : (
        items.length > 0 && (
          <p className="help">
            {items.length === 1
              ? 'מתנה אחת שמורה, אבל היא לא נכללת בחישוב כרגע.'
              : `${formatNumber(items.length)} מתנות שמורות, אבל הן לא נכללות בחישוב כרגע.`}
          </p>
        )
      )}
    </OptionalSection>
  )
}
