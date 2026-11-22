import { useState } from 'react'
import Icon from '../Icon.jsx'
import Reveal from '../Reveal.jsx'
import { MAX_TASKS, MAX_TITLE_LENGTH, TASK_MESSAGES } from '../../lib/taskState.js'

/**
 * "New task" form. Enter or the button adds; focus stays in the field so several
 * tasks can be typed in a row.
 *
 * @param {{ onAdd: (title: string) => string | null, isFull: boolean }} props
 *   `onAdd` returns an error message, or null on success.
 */
export default function TaskComposer({ onAdd, isFull }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    const result = onAdd(value)
    if (result) {
      setError(result)
      return
    }
    setValue('')
    setError(null)
  }

  return (
    <Reveal as="form" className="card composer" onSubmit={handleSubmit} noValidate aria-label="הוספת משימה">
      <label htmlFor="new-task">משימה חדשה</label>
      <div className="composer-row">
        <div className={`input-wrap composer-input${error ? ' is-invalid' : ''}`}>
          <input
            id="new-task"
            type="text"
            autoComplete="off"
            maxLength={MAX_TITLE_LENGTH + 20}
            placeholder="למשל: לסגור צלם מגנטים"
            value={value}
            disabled={isFull}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'new-task-error' : isFull ? 'new-task-limit' : undefined}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
          />
        </div>
        <button type="submit" className="btn btn-gold composer-btn" disabled={isFull}>
          <Icon name="plus" strokeWidth={2.4} />
          הוסף משימה
        </button>
      </div>
      {error && <p className="error" id="new-task-error"><Icon name="alert" strokeWidth={2} /><span>{error}</span></p>}
      {isFull && <p className="help" id="new-task-limit">{TASK_MESSAGES.limit} ({MAX_TASKS}).</p>}
    </Reveal>
  )
}
