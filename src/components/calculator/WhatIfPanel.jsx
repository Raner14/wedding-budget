import { useState } from 'react'
import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import { Sprig } from '../Botanicals.jsx'
import { applyScenario, calculateBudget } from '../../lib/budget.js'
import { formatMoney, formatNumber } from '../../lib/format.js'
import { STATUS } from './summaryView.js'
import './WhatIfPanel.css'

const RATE_MIN = 50
const RATE_MAX = 100
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

const pctText = (v) => (v === 0 ? '0%' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`)
const pctVoice = (v, what) => (v === 0 ? `ללא שינוי ב${what}` : `${v > 0 ? 'עלייה' : 'ירידה'} של ${Math.abs(v)} אחוזים ב${what}`)

/** Track fill as a CSS gradient; centered sliders fill from the middle (0%). */
function fillStyle(value, min, max, centered) {
  const pos = ((value - min) / (max - min)) * 100
  const [a, b] = centered ? [Math.min(50, pos), Math.max(50, pos)] : [0, pos]
  const track = 'rgb(210 193 172 / .45)'
  return { '--fill': `linear-gradient(to right, ${track} ${a}%, #D9B77E ${a}%, #C98A8F ${b}%, ${track} ${b}%)` }
}

function Slider({ id, label, icon, value, min, max, step, centered, output, valueText, hint, scale, disabled, onChange }) {
  return (
    <div className="slider-field">
      <div className="slider-top">
        <label htmlFor={id}><Icon name={icon} />{label}</label>
        <output htmlFor={id} dir="ltr">{output}</output>
      </div>
      <input
        id={id}
        type="range"
        dir="ltr"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText}
        aria-describedby={hint ? `${id}-hint` : undefined}
        style={fillStyle(value, min, max, centered)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-scale" dir="ltr" aria-hidden="true">{scale.map((s) => <span key={s}>{s}</span>)}</div>
      <p className="slider-hint" id={`${id}-hint`}>{hint}</p>
    </div>
  )
}

/**
 * Step 3 — explore scenarios without touching the entered data.
 * Slider positions are temporary UI state (not persisted).
 *
 * @param {{ values: object | null, disabledReason: string | null }} props
 *   `values` are the current valid budget values; null disables the panel.
 */
export default function WhatIfPanel({ values, disabledReason }) {
  const [mealPct, setMealPct] = useState(0)
  const [giftPct, setGiftPct] = useState(0)
  /** null = follow the entered attendance rate exactly. */
  const [rateOverride, setRateOverride] = useState(null)

  const enabled = values !== null
  const baseRate = values?.attendanceRate ?? RATE_MAX
  const sliderRate = rateOverride ?? clamp(baseRate, RATE_MIN, RATE_MAX)
  const isNeutral = mealPct === 0 && giftPct === 0 && rateOverride === null

  let scenario = null
  if (enabled) {
    const scenarioValues = applyScenario(values, {
      mealPriceChangePct: mealPct,
      attendanceRate: rateOverride ?? values.attendanceRate,
      giftChangePct: giftPct,
    })
    const base = calculateBudget(values)
    const result = calculateBudget(scenarioValues)
    scenario = { values: scenarioValues, result, diff: result.balance - base.balance }
  }

  function reset() {
    setMealPct(0)
    setGiftPct(0)
    setRateOverride(null)
  }

  const status = scenario ? STATUS[scenario.result.balanceStatus] : null
  const diffTone = !scenario || scenario.diff === 0 ? 'even' : scenario.diff > 0 ? 'profit' : 'loss'

  return (
    <Reveal as="section" className={`card whatif${enabled ? '' : ' is-disabled'}`} aria-labelledby="whatif-title">
      <Sprig className="sprig" />
      <div className="card-head">
        <span className="card-icon" aria-hidden="true"><Icon name="sun" /></span>
        <div>
          <p className="card-kicker">שלב 3</p>
          <h3 id="whatif-title" className="card-title">ומה אם...?</h3>
          <p className="card-desc">הזיזו את הסליידרים כדי לבחון תרחישים. הנתונים שהזנתם לא ישתנו.</p>
        </div>
      </div>

      {!enabled && (
        <div className="alert alert-info alert-first">
          <Icon name="info" strokeWidth={2} />
          <p>{disabledReason}</p>
        </div>
      )}

      <div className="sliders">
        <Slider
          id="scenario-meal"
          label="המנה מתייקרת?"
          icon="dish"
          value={mealPct} min={-30} max={30} step={5} centered
          output={pctText(mealPct)}
          valueText={pctVoice(mealPct, 'מחיר המנה')}
          scale={['−30%', '0', '+30%']}
          hint={scenario && `מחיר מנה בתרחיש: ${formatMoney(scenario.values.mealPrice)}${scenario.values.reserveMeals > 0 ? ` · רזרבה: ${formatMoney(scenario.values.reserveMealPrice)}` : ''}`}
          disabled={!enabled}
          onChange={setMealPct}
        />
        <Slider
          id="scenario-rate"
          label="פחות אורחים מגיעים?"
          icon="users"
          value={sliderRate} min={RATE_MIN} max={RATE_MAX} step={1}
          output={`${rateOverride ?? baseRate}%`}
          valueText={`${rateOverride ?? baseRate} אחוזי הגעה`}
          scale={['50%', '75%', '100%']}
          hint={scenario && `≈ ${formatNumber(scenario.result.attendingGuests)} אורחים מגיעים (מתוך ${formatNumber(values.invitedGuests)})`}
          disabled={!enabled}
          onChange={setRateOverride}
        />
        <Slider
          id="scenario-gift"
          label="המתנות משתנות?"
          icon="gift"
          value={giftPct} min={-30} max={30} step={5} centered
          output={pctText(giftPct)}
          valueText={pctVoice(giftPct, 'מתנה הממוצעת')}
          scale={['−30%', '0', '+30%']}
          hint={scenario && `מתנה ממוצעת בתרחיש: ${formatMoney(scenario.values.averageGift)}`}
          disabled={!enabled}
          onChange={setGiftPct}
        />
      </div>

      <div className="whatif-results" aria-live="polite">
        <div className={`w-tile tone-${scenario ? scenario.result.balanceStatus : 'even'}`} data-testid="scenario-balance">
          <p className="w-label">המאזן בתרחיש</p>
          <div className="w-value">
            {scenario ? (
              <><Icon name={status.icon} strokeWidth={2.4} /><span>{status.label}</span><bdi>{formatMoney(Math.abs(scenario.result.balance))}</bdi></>
            ) : '—'}
          </div>
        </div>
        <div className={`w-tile tone-${diffTone}`} data-testid="scenario-diff">
          <p className="w-label">לעומת המצב הנוכחי</p>
          <div className="w-value">
            {!scenario ? '—' : scenario.diff === 0 ? (
              <><Icon name="even" strokeWidth={2.4} /><span>ללא שינוי</span></>
            ) : (
              <>
                <Icon name={scenario.diff > 0 ? 'up' : 'down'} strokeWidth={2.4} />
                <span>{scenario.diff > 0 ? 'עלייה של' : 'ירידה של'}</span>
                <bdi>{formatMoney(Math.abs(scenario.diff))}</bdi>
              </>
            )}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={!enabled || isNeutral}>
          <Icon name="refresh" strokeWidth={2} />
          איפוס תרחיש
        </button>
      </div>
    </Reveal>
  )
}
