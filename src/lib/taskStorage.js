/**
 * Versioned persistence for the task planner, under its own key so it can never
 * affect the calculator's data. Stored data is never trusted: every task is
 * type-checked; broken tasks are dropped instead of failing the whole list.
 */
import { readJSON, writeJSON } from './safeStorage.js'
import {
  createInitialTaskState,
  createTaskId,
  MAX_TASKS,
  TASK_STATE_VERSION,
  toPersistedTasks,
  validateTaskTitle,
} from './taskState.js'

export const TASKS_STORAGE_KEY = 'wedding-budget:tasks:v1'
const MAX_ID_LENGTH = 64

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * @param {unknown} data
 * @returns {{ tasks: {id: string, title: string, done: boolean}[] } | null}
 */
export function sanitizeTasks(data) {
  if (!isObject(data) || data.version !== TASK_STATE_VERSION || !Array.isArray(data.tasks)) return null
  const seen = new Set()
  const tasks = []
  for (const item of data.tasks) {
    if (tasks.length >= MAX_TASKS) break
    if (!isObject(item)) continue
    const valid = validateTaskTitle(typeof item.title === 'string' ? item.title : '')
    if ('error' in valid) continue
    let id = typeof item.id === 'string' && item.id !== '' ? item.id.slice(0, MAX_ID_LENGTH) : ''
    if (id === '' || seen.has(id)) id = createTaskId()
    seen.add(id)
    tasks.push({ id, title: valid.title, done: item.done === true })
  }
  return { tasks }
}

/** Lazy initializer for useReducer. */
export function loadTasks() {
  return createInitialTaskState(sanitizeTasks(readJSON(TASKS_STORAGE_KEY)) ?? undefined)
}

/** @returns {boolean} Whether saving succeeded. */
export function saveTasks(state) {
  return writeJSON(TASKS_STORAGE_KEY, toPersistedTasks(state))
}
