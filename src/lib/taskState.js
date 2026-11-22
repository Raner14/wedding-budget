/**
 * Wedding task planner state. Independent of the calculator.
 * The reducer is pure; new task IDs are created by `createTask` (caller side).
 */

export const TASK_STATE_VERSION = 1
export const MAX_TASKS = 200
export const MAX_TITLE_LENGTH = 120

export const TASK_MESSAGES = {
  required: 'כתבו מה צריך לעשות',
  tooLong: `אפשר לכתוב עד ${MAX_TITLE_LENGTH} תווים`,
  limit: `אפשר לשמור עד ${MAX_TASKS} משימות`,
}

/**
 * Trims and validates a task title.
 * @param {string} raw
 * @returns {{ title: string } | { error: string }}
 */
export function validateTaskTitle(raw) {
  const title = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (title === '') return { error: TASK_MESSAGES.required }
  if (title.length > MAX_TITLE_LENGTH) return { error: TASK_MESSAGES.tooLong }
  return { title }
}

export function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Creates a task from user input, or returns the validation error.
 * @param {string} rawTitle
 * @returns {{ task: {id: string, title: string, done: boolean} } | { error: string }}
 */
export function createTask(rawTitle) {
  const result = validateTaskTitle(rawTitle)
  if ('error' in result) return result
  return { task: { id: createTaskId(), title: result.title, done: false } }
}

/** @param {{ tasks?: object[] }} [data] */
export function createInitialTaskState(data) {
  return { tasks: data?.tasks ?? [] }
}

export const taskActions = {
  added: (task) => ({ type: 'taskAdded', task }),
  renamed: (id, title) => ({ type: 'taskRenamed', id, title }),
  toggled: (id) => ({ type: 'taskToggled', id }),
  removed: (id) => ({ type: 'taskRemoved', id }),
  restored: (task, index) => ({ type: 'taskRestored', task, index }),
}

/**
 * Invalid actions (empty titles, unknown IDs, duplicates, over the limit) return
 * the same state object, so callers and tests can detect "no change".
 */
export function taskReducer(state, action) {
  switch (action.type) {
    case 'taskAdded': {
      if (state.tasks.length >= MAX_TASKS) return state
      if (state.tasks.some((t) => t.id === action.task.id)) return state
      const valid = validateTaskTitle(action.task.title)
      if ('error' in valid) return state
      return { ...state, tasks: [...state.tasks, { id: action.task.id, title: valid.title, done: Boolean(action.task.done) }] }
    }
    case 'taskRenamed': {
      const valid = validateTaskTitle(action.title)
      if ('error' in valid) return state
      const current = state.tasks.find((t) => t.id === action.id)
      if (!current || current.title === valid.title) return state
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, title: valid.title } : t)) }
    }
    case 'taskToggled':
      if (!state.tasks.some((t) => t.id === action.id)) return state
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) }

    case 'taskRemoved':
      if (!state.tasks.some((t) => t.id === action.id)) return state
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }

    case 'taskRestored': {
      if (state.tasks.some((t) => t.id === action.task.id) || state.tasks.length >= MAX_TASKS) return state
      const index = Math.max(0, Math.min(action.index, state.tasks.length))
      const tasks = [...state.tasks]
      tasks.splice(index, 0, action.task)
      return { ...state, tasks }
    }
    default:
      return state
  }
}

/**
 * Completion summary. The percentage is rounded DOWN so it only reads 100%
 * when every task is truly done (199 of 200 → 99%, not 100%).
 * @param {{done: boolean}[]} tasks
 */
export function taskProgress(tasks) {
  const total = tasks.length
  const completed = tasks.filter((t) => t.done).length
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total === 0 ? 0 : Math.floor((completed / total) * 100),
    allDone: total > 0 && completed === total,
  }
}

export function toPersistedTasks(state) {
  return { version: TASK_STATE_VERSION, tasks: state.tasks }
}
