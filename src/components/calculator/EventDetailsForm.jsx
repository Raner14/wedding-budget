import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import { Heart, Rings } from '../Botanicals.jsx'
import NumberField from './NumberField.jsx'
import ReserveSection from './ReserveSection.jsx'
import FamilyGifts from './FamilyGifts.jsx'
import { formatNumber } from '../../lib/format.js'
import './EventDetailsForm.css'

/**
 * Step 1 — guests, venue & meals (with optional reserve guests), gifts (with optional family gifts).
 *
 * @param {{
 *   event: Record<string, string>,
 *   errors: Record<string, string>,
 *   attending: { base: number, reserve: number } | null,
 *   onFieldChange: (field: string, value: string) => void,
 *   reserve: { info: object | null, notice: object | null, onDismissNotice: () => void, onAddPrepaidExpense: () => void },
 *   family: object,
 * }} props   `family` holds the FamilyGifts props.
 */
export default function EventDetailsForm({ event, errors, attending, onFieldChange, reserve, family }) {

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
              <strong>{attending === null ? '—' : `≈ ${formatNumber(attending.base + attending.reserve)} אורחים`}</strong>
              {attending?.reserve > 0 && <span className="computed-note"> (כולל {formatNumber(attending.reserve)} מהרזרבה)</span>}
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
          <ReserveSection
            event={event}
            errors={errors}
            field={field}
            info={reserve.info}
            notice={reserve.notice}
            onDismissNotice={reserve.onDismissNotice}
            onAddPrepaidExpense={reserve.onAddPrepaidExpense}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend><Icon name="gift" />המתנות</legend>
        <div className="fields">
          <NumberField {...field('averageGift')} label="מתנה ממוצעת לאורח מגיע (₪)" unit="₪" placeholder="למשל 450" help="ממוצע לאורח שמגיע, לא לזוג." />
          <FamilyGifts {...family} />
        </div>
      </fieldset>
    </Reveal>
  )
}
