import Icon from './Icon.jsx'

/**
 * "Item deleted · Undo" toast. Announced politely to screen readers.
 * The 6-second auto-dismiss timer is owned by the parent; the progress bar is visual only.
 *
 * @param {{ message: string, onUndo: () => void, onClose: () => void }} props
 */
export default function UndoToast({ message, onUndo, onClose }) {
  return (
    <div className="toast is-running" role="status" aria-live="polite">
      <span className="toast-msg">{message}</span>
      <button type="button" className="toast-undo" onClick={onUndo}>ביטול</button>
      <button type="button" className="toast-close" aria-label="סגירת ההודעה" onClick={onClose}>
        <Icon name="close" strokeWidth={2} />
      </button>
      <span className="toast-progress" aria-hidden="true" />
    </div>
  )
}
