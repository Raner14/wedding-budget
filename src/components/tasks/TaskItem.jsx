import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../Icon.jsx'
import { Blossom } from '../Botanicals.jsx'
import { prefersReducedMotion } from '../motion.js'
import { MAX_TITLE_LENGTH, validateTaskTitle } from '../../lib/taskState.js'

/**
 * One checklist row: completion checkbox, title (editable inline) and actions.
 *
 * Editing: Enter or "שמירה" saves; Escape or "ביטול" cancels; leaving the row
 * saves a valid title and silently keeps the old one otherwise.
 *
 * @param {{
 *   task: {id: string, title: string, done: boolean},
 *   index: number,
 *   onToggle: (id: string) => void,
 *   onRename: (id: string, title: string) => void,
 *   onDelete: (task: object, index: number) => void,
 * }} props
 */
export default function TaskItem({ task, index, onToggle, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const [error, setError] = useState(null)
  const [justDone, setJustDone] = useState(false)
  const inputRef = useRef(null)
  const editButtonRef = useRef(null)
  const errorId = `task-${task.id}-error`

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  function startEditing() {
    setDraft(task.title)
    setError(null)
    setEditing(true)
  }

  /** @param {boolean} returnFocus  Move focus back to the edit button (keyboard/button flows). */
  function finish(save, returnFocus) {
    if (save) {
      const result = validateTaskTitle(draft)
      if ('error' in result) {
        if (returnFocus) {
          setError(result.error)
          return
        }
      } else {
        onRename(task.id, result.title)
      }
    }
    flushSync(() => {
      setEditing(false)
      setError(null)
    })
    if (returnFocus) editButtonRef.current?.focus()
  }

  function handleToggle() {
    onToggle(task.id)
    setJustDone(!task.done && !prefersReducedMotion())
  }

  const rowClass = ['task', task.done && 'is-done', justDone && 'just-done'].filter(Boolean).join(' ')

  return (
    <li className={rowClass}>
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={handleToggle} aria-label={task.title} />
        <span className="task-box" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
      </label>

      {editing ? (
        <div
          className="task-edit"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) finish(true, false)
          }}
        >
          <div className={`input-wrap task-edit-input${error ? ' is-invalid' : ''}`}>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={MAX_TITLE_LENGTH + 20}
              aria-label="עריכת המשימה"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => {
                setDraft(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finish(true, true)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  finish(false, true)
                }
              }}
            />
          </div>
          <div className="task-actions">
            <button type="button" className="icon-btn" aria-label="שמירת המשימה" onClick={() => finish(true, true)}>
              <Icon name="check" strokeWidth={2.2} />
            </button>
            <button type="button" className="icon-btn" aria-label="ביטול העריכה" onClick={() => finish(false, true)}>
              <Icon name="close" strokeWidth={2} />
            </button>
          </div>
          {error && <p className="error task-error" id={errorId}><Icon name="alert" strokeWidth={2} /><span>{error}</span></p>}
        </div>
      ) : (
        <>
          <span className="task-title">{task.title}</span>
          <div className="task-actions">
            <button type="button" className="icon-btn" ref={editButtonRef} aria-label={`עריכת המשימה ${task.title}`} onClick={startEditing}>
              <Icon name="edit" />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              data-role="delete-task"
              aria-label={`מחיקת המשימה ${task.title}`}
              onClick={() => onDelete(task, index)}
            >
              <Icon name="trash" />
            </button>
          </div>
        </>
      )}
      <Blossom className="task-bloom" onAnimationEnd={() => setJustDone(false)} />
    </li>
  )
}
