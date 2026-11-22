import { useEffect, useReducer } from 'react'
import { Blossom, SvgDefs } from './components/Botanicals.jsx'
import Hero from './components/Hero.jsx'
import Reveal from './components/Reveal.jsx'
import EventDetailsForm from './components/calculator/EventDetailsForm.jsx'
import { actions, budgetReducer } from './lib/budgetState.js'
import { loadBudget, saveBudget } from './lib/budgetStorage.js'
import { parseBudget, parseWhole } from './lib/validation.js'
import { calculateAttendingGuests } from './lib/budget.js'
import './App.css'

/** Attending guests can be shown as soon as both inputs it depends on are valid. */
function attendingFrom(event, errors) {
  if (errors.invitedGuests || errors.attendanceRate) return null
  return calculateAttendingGuests(parseWhole(event.invitedGuests).value, parseWhole(event.attendanceRate).value)
}

function App() {
  const [state, dispatch] = useReducer(budgetReducer, undefined, loadBudget)
  const { event, expenses } = state

  // Persist the raw input on every change. Failures are tolerated (private mode, quota).
  useEffect(() => {
    saveBudget({ event, expenses })
  }, [event, expenses])

  const parsed = parseBudget(state)

  return (
    <>
      <SvgDefs />
      <div className="app">
        <div className="app-inner">
          <Hero />

          <Reveal className="section-intro" id="calculator">
            <div className="ornament" aria-hidden="true"><Blossom /></div>
            <p className="kicker">המחשבון שלנו</p>
            <h2 className="section-title">כמה תעלה החתונה, וכמה תחזיר?</h2>
            <p className="section-sub">ממלאים כמה פרטים, והמאזן מתעדכן מיד. אפשר לשנות כל דבר בכל רגע.</p>
          </Reveal>

          <main className="layout">
            <div className="col-inputs">
              <EventDetailsForm
                event={event}
                errors={parsed.errors.event}
                attendingGuests={attendingFrom(event, parsed.errors.event)}
                onFieldChange={(field, value) => dispatch(actions.fieldChanged(field, value))}
              />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

export default App
