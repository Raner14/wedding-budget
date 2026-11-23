import Icon from '../Icon.jsx'
import NumberField from './NumberField.jsx'
import OptionalSection from './OptionalSection.jsx'
import { formatMoney, formatNumber } from '../../lib/format.js'

const MODELS = [
  {
    value: 'as-needed',
    title: 'משלמים רק על מה שצריך',
    description: 'האולם גובה רק על מנות מעבר למה שכבר שולם. מנות מובטחות שלא נוצלו מכסות אורחי רזרבה בלי תשלום נוסף.',
  },
  {
    value: 'prepaid',
    title: 'רזרבה ששולמה מראש',
    description: 'משלמים פעם אחת על כל מקומות הרזרבה, גם אם לא ינוצלו. אורחי רזרבה יושבים בהם בלי תשלום נוסף.',
  },
]

/** A short, plain-Hebrew explanation of how the reserve is being calculated. */
function ReserveExplanation({ info }) {
  if (!info) return null
  const { reserveGuests, coveredByGuaranteed, reserveMealsBilled, reserveCost, reserveModel, unusedReserveMeals, reserveGift } = info
  if (reserveModel === 'as-needed' && reserveGuests === 0) return null
  const parts = []
  if (reserveGuests > 0) parts.push(`${formatNumber(reserveGuests)} אורחים נוספים, ומתנה של ${formatMoney(reserveGift)} מכל אחד`)
  if (reserveModel === 'prepaid') {
    parts.push(`${formatNumber(reserveMealsBilled)} מנות רזרבה ששולמו מראש (${formatMoney(reserveCost)})`)
    if (unusedReserveMeals > 0) parts.push(`${formatNumber(unusedReserveMeals)} מהן לא ינוצלו`)
  } else {
    if (coveredByGuaranteed > 0) parts.push(`${formatNumber(coveredByGuaranteed)} מהם במנות מובטחות שכבר שולמו`)
    parts.push(reserveMealsBilled > 0 ? `${formatNumber(reserveMealsBilled)} מנות בתשלום נוסף (${formatMoney(reserveCost)})` : 'בלי תשלום נוסף על מנות')
  }
  return (
    <p className="computed reserve-explanation" aria-live="polite">
      <span className="computed-icon" aria-hidden="true"><Icon name="info" strokeWidth={2} /></span>
      <span>{parts.join(' · ')}</span>
    </p>
  )
}

/**
 * Reserve guests: places kept by the venue, expected extra guests, billing model,
 * and optional overrides for the reserve meal price and reserve-guest gift.
 *
 * @param {{
 *   event: Record<string, string>,
 *   errors: Record<string, string>,
 *   field: (name: string) => object,
 *   onFieldChange: (field: string, value: string) => void,
 *   info: object | null,
 *   showMigrationNotice: boolean,
 *   onDismissNotice: () => void,
 * }} props
 */
export default function ReserveSection({ event, errors, field, onFieldChange, info, showMigrationNotice, onDismissNotice }) {
  const hasValues = ['reserveAvailable', 'reserveGuests', 'reserveMealPrice', 'reserveGift'].some((k) => event[k].trim() !== '')
  const hasError = Boolean(errors.reserveAvailable || errors.reserveGuests || errors.reserveMealPrice || errors.reserveGift)

  return (
    <OptionalSection title="אורחי רזרבה" className="reserve-section" defaultOpen={hasValues || showMigrationNotice} forceOpen={hasError}>
      {showMigrationNotice && (
        <div className="alert alert-info alert-first" role="note">
          <Icon name="info" strokeWidth={2} />
          <div>
            <strong>עדכנו את חישוב הרזרבה</strong>
            <p>
              מנות הרזרבה שהזנתם קודם נשמרו כ״רזרבה ששולמה מראש״, בלי אורחים נוספים, כך שהתוצאה נשארה בדיוק כמו קודם.
              עכשיו אפשר גם להוסיף אורחי רזרבה שמגיעים ומביאים מתנה.
            </p>
            <button type="button" className="link-btn" onClick={onDismissNotice}>הבנתי</button>
          </div>
        </div>
      )}

      <p className="help help-top" id="reserve-help">
        אורחי רזרבה הם אורחים שעשויים להגיע מעבר להערכת ההגעה. הם מוסיפים מנות, וגם מתנות.
      </p>

      <fieldset className="model-picker">
        <legend>איך האולם גובה על הרזרבה?</legend>
        <div className="model-options">
          {MODELS.map((model) => (
            <label key={model.value} className={`model-option${event.reserveModel === model.value ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="reserveModel"
                value={model.value}
                checked={event.reserveModel === model.value}
                onChange={() => onFieldChange('reserveModel', model.value)}
                aria-describedby={`model-${model.value}-desc`}
              />
              <span className="model-text">
                <span className="model-title">{model.title}</span>
                <span className="model-desc" id={`model-${model.value}-desc`}>{model.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="fields">
        <NumberField {...field('reserveAvailable')} label="מקומות רזרבה" unit="מקומות" placeholder="0" help="כמה מקומות נוספים האולם שומר עבורכם." />
        <NumberField {...field('reserveGuests')} label="כמה מהם צפויים להגיע" unit="אורחים" placeholder="0" help="אורחים מעבר להערכת ההגעה למעלה." />
        <NumberField {...field('reserveMealPrice')} label="מחיר למנת רזרבה (₪)" unit="₪" placeholder="כמו מנה רגילה" help="ריק = כמו מחיר מנה רגילה." />
        <NumberField {...field('reserveGift')} label="מתנה ממוצעת מאורח רזרבה (₪)" unit="₪" placeholder="כמו המתנה הממוצעת" help="ריק = כמו המתנה הממוצעת." />
        <ReserveExplanation info={info} />
      </div>
    </OptionalSection>
  )
}
