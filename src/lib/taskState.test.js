// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  createInitialTaskState,
  createTask,
  MAX_TASKS,
  MAX_TITLE_LENGTH,
  TASK_MESSAGES,
  taskActions as a,
  taskProgress,
  taskReducer,
  toPersistedTasks,
  validateTaskTitle,
} from './taskState.js'

const task = (id, title = `task ${id}`, done = false) => ({ id, title, done })
const stateOf = (...tasks) => createInitialTaskState({ tasks })
const ids = (s) => s.tasks.map((t) => t.id)

describe('validateTaskTitle', () => {
  it('trims and collapses whitespace', () => {
    expect(validateTaskTitle('  לסגור   צלם  מגנטים ')).toEqual({ title: 'לסגור צלם מגנטים' })
  })

  it.each(['', '   ', '\n\t', undefined, null])('rejects an empty title (%j)', (raw) => {
    expect(validateTaskTitle(raw)).toEqual({ error: TASK_MESSAGES.required })
  })

  it(`accepts exactly ${MAX_TITLE_LENGTH} characters and rejects more`, () => {
    expect(validateTaskTitle('א'.repeat(MAX_TITLE_LENGTH))).toEqual({ title: 'א'.repeat(MAX_TITLE_LENGTH) })
    expect(validateTaskTitle('א'.repeat(MAX_TITLE_LENGTH + 1))).toEqual({ error: TASK_MESSAGES.tooLong })
  })
})

describe('createTask', () => {
  it('creates an open task with a unique id', () => {
    const one = createTask('לסגור אולם')
    const two = createTask('לסגור אולם')
    expect(one.task).toMatchObject({ title: 'לסגור אולם', done: false })
    expect(one.task.id).not.toBe(two.task.id)
  })

  it('returns the validation error for an empty title', () => {
    expect(createTask('  ')).toEqual({ error: TASK_MESSAGES.required })
  })
})

describe('taskReducer', () => {
  it('starts empty', () => {
    expect(createInitialTaskState()).toEqual({ tasks: [] })
  })

  it('adds tasks at the end, trimmed', () => {
    const s = taskReducer(stateOf(task('a')), a.added(task('b', '  להזמין די-ג׳יי ')))
    expect(ids(s)).toEqual(['a', 'b'])
    expect(s.tasks[1]).toEqual({ id: 'b', title: 'להזמין די-ג׳יי', done: false })
  })

  it('ignores invalid, duplicate or over-limit additions', () => {
    const start = stateOf(task('a'))
    expect(taskReducer(start, a.added(task('b', '   ')))).toBe(start)
    expect(taskReducer(start, a.added(task('a', 'dup')))).toBe(start)
    const full = stateOf(...Array.from({ length: MAX_TASKS }, (_, i) => task(`t${i}`)))
    expect(taskReducer(full, a.added(task('extra')))).toBe(full)
  })

  it('renames a task with a trimmed title', () => {
    const s = taskReducer(stateOf(task('a', 'old')), a.renamed('a', '  new title '))
    expect(s.tasks[0].title).toBe('new title')
  })

  it('keeps the previous title when the new one is empty, too long, unchanged or the id is unknown', () => {
    const start = stateOf(task('a', 'old'))
    expect(taskReducer(start, a.renamed('a', '  '))).toBe(start)
    expect(taskReducer(start, a.renamed('a', 'x'.repeat(MAX_TITLE_LENGTH + 1)))).toBe(start)
    expect(taskReducer(start, a.renamed('a', ' old '))).toBe(start)
    expect(taskReducer(start, a.renamed('zzz', 'new'))).toBe(start)
  })

  it('toggles completion both ways', () => {
    const done = taskReducer(stateOf(task('a')), a.toggled('a'))
    expect(done.tasks[0].done).toBe(true)
    expect(taskReducer(done, a.toggled('a')).tasks[0].done).toBe(false)
  })

  it('removes a task and restores it at its original position with its completion state', () => {
    const start = stateOf(task('a'), task('b', 'b', true), task('c'))
    const removed = taskReducer(start, a.removed('b'))
    expect(ids(removed)).toEqual(['a', 'c'])
    const restored = taskReducer(removed, a.restored(start.tasks[1], 1))
    expect(restored.tasks).toEqual(start.tasks)
  })

  it('clamps the restore index and never duplicates', () => {
    const start = stateOf(task('a'), task('b'))
    const afterRemove = taskReducer(start, a.removed('a'))
    expect(ids(taskReducer(afterRemove, a.restored(start.tasks[0], 50)))).toEqual(['b', 'a'])
    expect(taskReducer(start, a.restored(start.tasks[0], 0))).toBe(start)
  })

  it('returns the same state for unknown ids and actions', () => {
    const start = stateOf(task('a'))
    expect(taskReducer(start, a.toggled('nope'))).toBe(start)
    expect(taskReducer(start, a.removed('nope'))).toBe(start)
    expect(taskReducer(start, { type: 'mystery' })).toBe(start)
  })

  it('does not mutate the previous state', () => {
    const start = Object.freeze({ tasks: Object.freeze([Object.freeze(task('a'))]) })
    expect(() => taskReducer(start, a.toggled('a'))).not.toThrow()
    expect(start.tasks[0].done).toBe(false)
  })
})

describe('taskProgress', () => {
  it('is zero for an empty list (no division by zero)', () => {
    expect(taskProgress([])).toEqual({ total: 0, completed: 0, remaining: 0, percent: 0, allDone: false })
  })

  it('counts completed and remaining tasks', () => {
    const p = taskProgress([task('a', 'a', true), task('b'), task('c', 'c', true), task('d'), task('e')])
    expect(p).toEqual({ total: 5, completed: 2, remaining: 3, percent: 40, allDone: false })
  })

  it('rounds DOWN so 100% means everything is done', () => {
    expect(taskProgress([task('a', 'a', true), task('b', 'b', true), task('c')]).percent).toBe(66)
    const almost = Array.from({ length: 200 }, (_, i) => task(`t${i}`, 't', i < 199))
    expect(taskProgress(almost).percent).toBe(99)
    expect(taskProgress(almost).allDone).toBe(false)
  })

  it('reports all done', () => {
    expect(taskProgress([task('a', 'a', true)])).toMatchObject({ percent: 100, allDone: true })
  })
})

describe('toPersistedTasks', () => {
  it('stores a versioned list', () => {
    expect(toPersistedTasks(stateOf(task('a')))).toEqual({ version: 1, tasks: [task('a')] })
  })
})
