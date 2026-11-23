import Icon from '../Icon.jsx'
import NumberField from './NumberField.jsx'
import OptionalSection from './OptionalSection.jsx'
import { formatMoney, formatNumber } from '../../lib/format.js'
import { parseWhole } from '../../lib/validation.js'

/** "כמו מנה רגילה (₪380)" — shows the value a blank override falls back to, when known. */
function sameAsPlaceholder(label, raw) {
  const parsed = String(raw ?? '').trim() === '' ? null : parseWhole(raw)
  return parsed && 'value' in parsed ? `${label} (${formatMoney(parsed.value)})` : label
}

/** Explains, once, that prepaid reserve meals are no longer counted — with a way to keep them. */
function PrepaidReserveNotice({ notice, onDismiss, onAddExpense }) {
  const { meals, previousCost, suggestedExpense } = notice
  return (
    <div className="alert alert-info alert-first" role="note">
      <Icon name="info" strokeWidth={2} />
      <div>
        <strong>שינינו את חישוב הרזרבות</strong>
        <p>
          עכשיו משלמים רק על אורחי רזרבה שמגיעים בפועל.
          {previousCost !== null
            ? ` עד עכשיו נחשבו אצלכם ${meals} מנות רזרבה ששולמו מראש (${formatMoney(previousCost)}), גם בלי שאורחים הגיעו.`
            : ` עד עכשיו נחשבו אצלכם ${meals} מנות רזרבה ששולמו מראש, גם בלי שאורחים הגיעו.`}
        </p>
        {suggestedExpense > 0 && (
          <p>אם האולם שלכם גובה עליהן מראש בכל מקרה, הוסיפו {formatMoney(suggestedExpense)} כהוצאה, והמאזן יחזור להיות בדיוק כמו קודם.</p>
        )}
        <div className="notice-actions">
          {suggestedExpense > 0 && (
            <button type="button" className="btn btn-soft notice-btn" onClick={onAddExpense}>
              הוספה כהוצאה
            </button>
          )}
          <button type="button" className="link-btn" onClick={onDismiss}>{suggestedExpense > 0 ? 'הבנתי, בלי הוצאה' : 'הבנתי'}</button>
        </div>
      </div>
    </div>
  )
}

/** Reserve meal costs, extra gifts and the net effect on the balance. */
function ReserveBreakdown({ info }) {
  if (!info) return null
  const { reserveGuests, coveredByGuaranteed, reserveMealsBilled, reserveMealPrice, reserveCost, reserveGift, reserveGiftIncome, reserveNetImpact } = info
  if (reserveGuests === 0) {
    return <p className="help reserve-zero">כל עוד אף אחד מהרזרבה לא מגיע, אין עלות נוספת ואין מתנות נוספות.</p>
  }
  const netWord = reserveNetImpact > 0 ? 'תוספת למאזן' : reserveNetImpact < 0 ? 'הפחתה מהמאזן' : 'ללא שינוי במאזן'
  const netTone = reserveNetImpact > 0 ? 'tone-profit' : reserveNetImpact < 0 ? 'tone-loss' : 'tone-even'
  return (
    <dl className="reserve-breakdown" aria-live="polite">
      <div className="rb-row">
        <dt>
          עלות מנות רזרבה
          <span className="rb-sub">
            {reserveMealsBilled > 0 && `${formatNumber(reserveMealsBilled)} מנות × ${formatMoney(reserveMealPrice)}`}
            {reserveMealsBilled > 0 && coveredByGuaranteed > 0 && ' · '}
            {coveredByGuaranteed > 0 && `${formatNumber(coveredByGuaranteed)} במנות מובטחות שכבר שולמו`}
          </span>
        </dt>
        <dd><bdi>{formatMoney(reserveCost)}</bdi></dd>
      </div>
      <div className="rb-row">
        <dt>
          מתנות נוספות
          <span className="rb-sub">{formatNumber(reserveGuests)} אורחים × {formatMoney(reserveGift)}</span>
        </dt>
        <dd><bdi>{formatMoney(reserveGiftIncome)}</bdi></dd>
      </div>
      <div className={`rb-row rb-net ${netTone}`}>
        <dt>
          <Icon name={reserveNetImpact > 0 ? 'up' : reserveNetImpact < 0 ? 'down' : 'even'} strokeWidth={2.4} />
          {netWord}
        </dt>
        <dd><bdi>{formatMoney(Math.abs(reserveNetImpact))}</bdi></dd>
      </div>
    </dl>
  )
}

/**
 * "רזרבות": reserve places and expected reserve guests. Only reserve guests who come
 * are paid for, and they first fill paid-but-unused guaranteed meals. The reserve meal
 * price and gift follow the regular values unless overridden under "הגדרות מתקדמות".
 *
 * @param {{
 *   event: Record<string, string>,
 *   errors: Record<string, string>,
 *   field: (name: string) => object,
 *   info: object | null,
 *   notice: { meals: string, previousCost: number|null, suggestedExpense: number|null } | null,
 *   onDismissNotice: () => void,
 *   onAddPrepaidExpense: () => void,
 * }} props
 */
export default function ReserveSection({ event, errors, field, info, notice, onDismissNotice, onAddPrepaidExpense }) {
  const hasValues = ['reserveAvailable', 'reserveGuests', 'reserveMealPrice', 'reserveGift'].some((k) => event[k].trim() !== '')
  const advancedError = Boolean(errors.reserveMealPrice || errors.reserveGift)
  const hasError = Boolean(errors.reserveAvailable || errors.reserveGuests || advancedError)
  const hasOverrides = event.reserveMealPrice.trim() !== '' || event.reserveGift.trim() !== ''

  return (
    <OptionalSection
      title="רזרבות"
      subtitle="משלמים רק על מי שמגיע"
      className="reserve-section"
      defaultOpen={hasValues || notice !== null}
      forceOpen={hasError}
    >
      {notice && <PrepaidReserveNotice notice={notice} onDismiss={onDismissNotice} onAddExpense={onAddPrepaidExpense} />}

      <p className="help help-top">
        אורחים שעשויים להגיע מעבר להערכת ההגעה. משלמים רק על מי שמגיע בפועל, וקודם מנצלים מנות מובטחות שכבר שולמו.
      </p>

      <div className="fields">
        <NumberField {...field('reserveAvailable')} label="כמה מקומות רזרבה?" unit="מקומות" placeholder="0" />
        <NumberField {...field('reserveGuests')} label="כמה צפויים להגיע?" unit="אורחים" placeholder="0" />
      </div>

      <ReserveBreakdown info={info} />

      <OptionalSection title="הגדרות מתקדמות" optional={false} className="advanced" defaultOpen={hasOverrides} forceOpen={advancedError}>
        <div className="fields">
          <NumberField
            {...field('reserveMealPrice')}
            label="מחיר למנת רזרבה (₪)"
            unit="₪"
            placeholder={sameAsPlaceholder('כמו מנה רגילה', event.mealPrice)}
            help="ריק = כמו מחיר מנה רגילה."
          />
          <NumberField
            {...field('reserveGift')}
            label="מתנה מאורח רזרבה (₪)"
            unit="₪"
            placeholder={sameAsPlaceholder('כמו המתנה הממוצעת', event.averageGift)}
            help="ריק = כמו המתנה הממוצעת."
          />
        </div>
      </OptionalSection>
    </OptionalSection>
  )
}
