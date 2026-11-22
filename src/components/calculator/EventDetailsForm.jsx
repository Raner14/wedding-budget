import { useState } from 'react'
import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import { Heart, Rings } from '../Botanicals.jsx'
import NumberField from './NumberField.jsx'
import { formatNumber } from '../../lib/format.js'
import './EventDetailsForm.css'

/**
 * Step 1 — guests, venue & meals, gifts.
 *
 * @param {{
 *   event: Record<string, string>,
 *   errors: Record<string, string>,
 *   attendingGuests: number | null,
 *   onFieldChange: (field: string, value: string) => void,
 * }} props
 */
export default function EventDetailsForm({ event, errors, attendingGuests, onFieldChange }) {
  const [reserveOpen, setReserveOpen] = useState(() => Boolean(event.reserveMeals || event.reserveMealPrice))
  // Never hide a reserve field that has an error.
  const forceReserveOpen = Boolean(errors.reserveMeals || errors.reserveMealPrice)

  const field = (name) => ({
    id: `field-${name}`,
    value: event[name],
    error: errors[name],
    onChange: (value) => onFieldChange(name, value),
  })

  return (
    <Reveal as="section" className="card event-card" aria-labelledby="event-title">
      <div className="card-head">
        <span className="card-icon" aria-hidden="true"><Rings /></span>
        <div>
          <p className="card-kicker">שלב 1</p>
          <h3 id="event-title" className="card-title">האירוע שלכם</h3>
        </div>
      </div>

      <fieldset>
        <legend><Icon name="users" />האורחים</legend>
        <div className="fields">
          <NumberField {...field('invitedGuests')} label="כמה אורחים מזמינים?" unit="מוזמנים" placeholder="למשל 300" />
          <NumberField
            {...field('attendanceRate')}
            label="אחוז הגעה צפוי (%)"
            unit="%"
            formatOnBlur={false}
            help="85% הוא ערך התחלתי להמחשה בלבד, לא נתון סטטיסטי מבוסס."
          />
          <p className="computed" aria-live="polite">
            <span className="computed-icon" aria-hidden="true"><Heart /></span>
            <span>
              צפויים לחגוג איתכם:{' '}
              <strong>{attendingGuests === null ? '—' : `≈ ${formatNumber(attendingGuests)} אורחים`}</strong>
            </span>
          </p>
        </div>
      </fieldset>

      <fieldset>
        <legend><Icon name="dish" />האולם והמנות</legend>
        <div className="fields">
          <NumberField {...field('mealPrice')} label="מחיר למנה (₪)" unit="₪" placeholder="למשל 350" help="כולל מע״מ." />
          <NumberField
            {...field('minimumMeals')}
            label="מינימום מנות מובטח"
            unit="מנות"
            placeholder="אין"
            help="אם האולם דורש מספר מנות מינימלי. אחרת השאירו ריק."
          />
          <details
            className="reserve"
            open={reserveOpen || forceReserveOpen}
            onToggle={(e) => setReserveOpen(e.currentTarget.open)}
          >
            <summary
              onClick={(e) => {
                // React would not re-open it (its `open` prop stays true), so block the collapse itself.
                if (forceReserveOpen) e.preventDefault()
              }}
            >
              <Icon name="chevron" className="chev" strokeWidth={2} />
              מנות רזרבה <span className="opt">(אופציונלי)</span>
            </summary>
            <div className="reserve-body">
              <p className="help help-top" id="reserve-help">
                אם האולם גובה תשלום על מנות רזרבה, הזינו כמה מנות נוספות צפויות להיות מחויבות מעבר למנות הרגילות או
                המובטחות. אם לא, השאירו ריק.
              </p>
              <div className="fields">
                <NumberField {...field('reserveMeals')} label="מנות רזרבה לחיוב" unit="מנות" placeholder="0" helpId="reserve-help" />
                <NumberField {...field('reserveMealPrice')} label="מחיר למנת רזרבה (₪)" unit="₪" placeholder="למשל 200" helpId="reserve-help" />
              </div>
            </div>
          </details>
        </div>
      </fieldset>

      <fieldset>
        <legend><Icon name="gift" />המתנות</legend>
        <div className="fields">
          <NumberField {...field('averageGift')} label="מתנה ממוצעת לאורח מגיע (₪)" unit="₪" placeholder="למשל 450" help="ממוצע לאורח שמגיע, לא לזוג." />
        </div>
      </fieldset>
    </Reveal>
  )
}
