import { useEffect, useReducer, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Dock from '../components/Dock.jsx'
import Icon from '../components/Icon.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import UndoToast from '../components/UndoToast.jsx'
import TasksHeader from '../components/tasks/TasksHeader.jsx'
import TaskProgress from '../components/tasks/TaskProgress.jsx'
import TaskComposer from '../components/tasks/TaskComposer.jsx'
import TaskList from '../components/tasks/TaskList.jsx'
import { UNDO_TIMEOUT_MS } from '../components/undo.js'
import { isStorageAvailable } from '../lib/safeStorage.js'
import { createTask, MAX_TASKS, TASK_MESSAGES, taskActions, taskProgress, taskReducer } from '../lib/taskState.js'
import { loadTasks, saveTasks } from '../lib/taskStorage.js'
import './TasksPage.css'

export default function TasksPage() {
  const [state, dispatch] = useReducer(taskReducer, undefined, loadTasks)
  const { tasks } = state
  /** Only the most recent deletion can be undone. */
  const [pendingUndo, setPendingUndo] = useState(null)
  const [canSave] = useState(isStorageAvailable)
  const listRef = useRef(null)

  useEffect(() => {
    saveTasks({ tasks })
  }, [tasks])

  useEffect(() => {
    if (!pendingUndo) return undefined
    const timer = setTimeout(() => setPendingUndo(null), UNDO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [pendingUndo])

  const isFull = tasks.length >= MAX_TASKS

  /** @returns {string | null} An error message, or null when the task was added. */
  function handleAdd(rawTitle) {
    if (isFull) return TASK_MESSAGES.limit
    const result = createTask(rawTitle)
    if ('error' in result) return result.error
    dispatch(taskActions.added(result.task))
    return null
  }

  function handleDelete(task, index) {
    flushSync(() => {
      dispatch(taskActions.removed(task.id))
      setPendingUndo({ task, index })
    })
    // Keep keyboard users in place: the next row's delete button, or the composer.
    const buttons = listRef.current?.querySelectorAll('[data-role="delete-task"]') ?? []
    ;(buttons[index] ?? buttons[index - 1] ?? document.getElementById('new-task'))?.focus()
  }

  function handleUndo() {
    if (!pendingUndo) return
    const { task, index } = pendingUndo
    flushSync(() => {
      dispatch(taskActions.restored(task, index))
      setPendingUndo(null)
    })
    // The restored task is back at `index` in the freshly rendered list.
    listRef.current?.querySelectorAll('input[type="checkbox"]')[index]?.focus()
  }

  return (
    <>
      <div className="app-inner">
        <main id="main-content" tabIndex={-1} className="tasks-page">
          <TasksHeader />
          <TaskProgress progress={taskProgress(tasks)} />
          <TaskComposer onAdd={handleAdd} isFull={isFull} />
          <TaskList
            ref={listRef}
            tasks={tasks}
            onToggle={(id) => dispatch(taskActions.toggled(id))}
            onRename={(id, title) => dispatch(taskActions.renamed(id, title))}
            onDelete={handleDelete}
          />
        </main>

        <SiteFooter>
          {!canSave && (
            <div className="alert alert-warn storage-warning" role="alert">
              <Icon name="warning" strokeWidth={2} />
              <p>הדפדפן לא מאפשר לשמור נתונים, ולכן המשימות יימחקו ברענון הדף.</p>
            </div>
          )}
          <p>המשימות נשמרות רק בדפדפן שלכם ולא נשלחות לשום שרת.</p>
        </SiteFooter>
      </div>

      <Dock>
        {pendingUndo && (
          <UndoToast
            key={pendingUndo.task.id}
            message={`המשימה „${pendingUndo.task.title}” נמחקה`}
            onUndo={handleUndo}
            onClose={() => setPendingUndo(null)}
          />
        )}
      </Dock>
    </>
  )
}
