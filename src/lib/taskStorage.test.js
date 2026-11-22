import { describe, expect, it, vi } from 'vitest'
import { loadTasks, sanitizeTasks, saveTasks, TASKS_STORAGE_KEY } from './taskStorage.js'
import { BUDGET_STORAGE_KEY } from './budgetStorage.js'
import { MAX_TASKS } from './taskState.js'

const store = (value) => localStorage.setItem(TASKS_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))

describe('task persistence', () => {
  it('uses its own versioned key, separate from the calculator', () => {
    expect(TASKS_STORAGE_KEY).toBe('wedding-budget:tasks:v1')
    expect(TASKS_STORAGE_KEY).not.toBe(BUDGET_STORAGE_KEY)
  })

  it('starts empty when nothing is stored', () => {
    expect(loadTasks()).toEqual({ tasks: [] })
  })

  it('round-trips tasks including completion', () => {
    const state = { tasks: [{ id: 'a', title: 'לסגור אולם', done: true }, { id: 'b', title: 'צלם', done: false }] }
    expect(saveTasks(state)).toBe(true)
    expect(JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY))).toEqual({ version: 1, tasks: state.tasks })
    expect(loadTasks()).toEqual(state)
  })

  it('never touches the calculator data', () => {
    localStorage.setItem(BUDGET_STORAGE_KEY, 'calculator')
    saveTasks({ tasks: [] })
    expect(localStorage.getItem(BUDGET_STORAGE_KEY)).toBe('calculator')
  })

  it.each([
    ['malformed JSON', '{oops'],
    ['an unknown version', { version: 2, tasks: [] }],
    ['a missing tasks array', { version: 1 }],
    ['a non-array tasks field', { version: 1, tasks: 'x' }],
    ['null', 'null'],
  ])('falls back to an empty list for %s', (_label, value) => {
    store(value)
    expect(loadTasks()).toEqual({ tasks: [] })
  })

  it('falls back to an empty list when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadTasks()).toEqual({ tasks: [] })
  })

  it('reports a failed save without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(saveTasks({ tasks: [] })).toBe(false)
  })
})

describe('sanitizeTasks', () => {
  it('drops broken tasks but keeps the valid ones', () => {
    const out = sanitizeTasks({
      version: 1,
      tasks: [
        { id: 'a', title: 'טוב', done: true },
        null, 'x', 42,
        { id: 'b', title: '   ' },
        { id: 'c', title: 12 },
        { id: 'd', title: 'גם טוב', done: 'yes' },
      ],
    })
    expect(out.tasks).toEqual([{ id: 'a', title: 'טוב', done: true }, { id: 'd', title: 'גם טוב', done: false }])
  })

  it('drops titles that are too long and trims the rest', () => {
    const out = sanitizeTasks({ version: 1, tasks: [{ id: 'a', title: 'x'.repeat(121) }, { id: 'b', title: '  רב  ' }] })
    expect(out.tasks).toEqual([{ id: 'b', title: 'רב', done: false }])
  })

  it('repairs missing and duplicate ids', () => {
    const out = sanitizeTasks({ version: 1, tasks: [{ id: 'a', title: 'one' }, { id: 'a', title: 'two' }, { title: 'three' }] })
    expect(new Set(out.tasks.map((t) => t.id)).size).toBe(3)
    expect(out.tasks[0].id).toBe('a')
  })

  it(`keeps at most ${MAX_TASKS} tasks and drops unknown fields`, () => {
    const many = Array.from({ length: MAX_TASKS + 30 }, (_, i) => ({ id: `t${i}`, title: `task ${i}`, evil: '<script>' }))
    const out = sanitizeTasks({ version: 1, tasks: many })
    expect(out.tasks).toHaveLength(MAX_TASKS)
    expect(Object.keys(out.tasks[0])).toEqual(['id', 'title', 'done'])
  })
})
