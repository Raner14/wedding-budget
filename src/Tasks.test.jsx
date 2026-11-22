import { describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './test/renderApp.jsx'
import { TASKS_STORAGE_KEY } from './lib/taskStorage.js'
import { BUDGET_STORAGE_KEY } from './lib/budgetStorage.js'

const input = () => screen.getByLabelText('משימה חדשה')
const addButton = () => screen.getByRole('button', { name: 'הוסף משימה' })
const list = () => screen.queryByRole('list', { name: 'הרשימה שלנו' })
const titles = () => [...(list()?.querySelectorAll('.task-title, .task-edit input') ?? [])].map((el) => el.value ?? el.textContent)
const progressbar = () => screen.getByRole('progressbar', { name: 'התקדמות המשימות' })
const checkbox = (title) => screen.getByRole('checkbox', { name: title })
const toast = () => document.querySelector('.toast')
const seedTasks = (tasks) => localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: 1, tasks }))

async function addTasks(user, ...names) {
  for (const name of names) await user.type(input(), `${name}{Enter}`)
}

describe('Tasks page — empty state and adding', () => {
  it('starts with a friendly empty state and 0% progress', () => {
    renderApp('/tasks')
    expect(screen.getByText('הרשימה שלכם מחכה')).toBeTruthy()
    expect(progressbar().getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByText('עוד אין משימות ברשימה')).toBeTruthy()
  })

  it('adds a task with Enter, clears the field and keeps focus there', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await user.type(input(), 'לסגור צלם מגנטים{Enter}')
    expect(titles()).toEqual(['לסגור צלם מגנטים'])
    expect(input().value).toBe('')
    expect(document.activeElement).toBe(input())
    expect(screen.getByText('0 מתוך 1 הושלמו · נשארו 1')).toBeTruthy()
  })

  it('adds a task with the button and trims whitespace', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await user.type(input(), '   להזמין   די-ג׳יי  ')
    await user.click(addButton())
    expect(titles()).toEqual(['להזמין די-ג׳יי'])
    expect(document.activeElement).toBe(input()) // regression: focus returns to the field
  })

  it('rejects an empty task with an accessible error that clears on typing', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await user.type(input(), '   ')
    await user.click(addButton())
    expect(list()).toBeNull()
    expect(input().getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input().getAttribute('aria-describedby')).textContent).toContain('כתבו מה צריך לעשות')
    await user.type(input(), 'א')
    expect(input().getAttribute('aria-invalid')).toBeNull()
  })

  it('rejects titles longer than 120 characters', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await user.click(input())
    await user.paste('א'.repeat(121))
    await user.click(addButton())
    expect(screen.getByText('אפשר לכתוב עד 120 תווים')).toBeTruthy()
    expect(list()).toBeNull()
  })
})

describe('Tasks page — completing', () => {
  it('marks tasks done and undone, updating counts and the progress bar', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'אולם', 'צלם', 'שמלה')
    await user.click(checkbox('צלם'))
    expect(checkbox('צלם').checked).toBe(true)
    expect(checkbox('צלם').closest('.task').className).toContain('is-done')
    expect(progressbar().getAttribute('aria-valuenow')).toBe('33') // 1/3 rounded down
    expect(screen.getByText('1 מתוך 3 הושלמו · נשארו 2')).toBeTruthy()

    await user.click(checkbox('צלם'))
    expect(checkbox('צלם').checked).toBe(false)
    expect(progressbar().getAttribute('aria-valuenow')).toBe('0')
  })

  it('can be completed from the keyboard with Space', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'אולם')
    checkbox('אולם').focus()
    await user.keyboard(' ')
    expect(checkbox('אולם').checked).toBe(true)
  })

  it('celebrates when every task is done (and only then reads 100%)', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'אולם', 'צלם')
    await user.click(checkbox('אולם'))
    expect(screen.queryByText(/סיימתם את כל המשימות/)).toBeNull()
    await user.click(checkbox('צלם'))
    expect(progressbar().getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText(/סיימתם את כל המשימות/)).toBeTruthy()
  })
})

describe('Tasks page — editing', () => {
  it('renames with Enter and returns focus to the edit button', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'צלם')
    await user.click(screen.getByRole('button', { name: 'עריכת המשימה צלם' }))
    const edit = screen.getByRole('textbox', { name: 'עריכת המשימה' })
    expect(document.activeElement).toBe(edit)
    await user.clear(edit)
    await user.type(edit, '  לסגור צלם מגנטים {Enter}')
    expect(titles()).toEqual(['לסגור צלם מגנטים'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'עריכת המשימה לסגור צלם מגנטים' }))
    expect(checkbox('לסגור צלם מגנטים')).toBeTruthy()
  })

  it('cancels with Escape', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'צלם')
    await user.click(screen.getByRole('button', { name: 'עריכת המשימה צלם' }))
    await user.type(screen.getByRole('textbox', { name: 'עריכת המשימה' }), ' שינוי{Escape}')
    expect(titles()).toEqual(['צלם'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'עריכת המשימה צלם' }))
  })

  it('saves and cancels with the visible buttons', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'צלם')
    await user.click(screen.getByRole('button', { name: 'עריכת המשימה צלם' }))
    await user.type(screen.getByRole('textbox', { name: 'עריכת המשימה' }), ' וידאו')
    await user.click(screen.getByRole('button', { name: 'שמירת המשימה' }))
    expect(titles()).toEqual(['צלם וידאו'])

    await user.click(screen.getByRole('button', { name: 'עריכת המשימה צלם וידאו' }))
    await user.type(screen.getByRole('textbox', { name: 'עריכת המשימה' }), '!!!')
    await user.click(screen.getByRole('button', { name: 'ביטול העריכה' }))
    expect(titles()).toEqual(['צלם וידאו'])
  })

  it('keeps editing with an error when saving an empty title', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'צלם')
    await user.click(screen.getByRole('button', { name: 'עריכת המשימה צלם' }))
    const edit = screen.getByRole('textbox', { name: 'עריכת המשימה' })
    await user.clear(edit)
    await user.keyboard('{Enter}')
    expect(edit.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('כתבו מה צריך לעשות')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(titles()).toEqual(['צלם'])
  })

  it('saves a valid edit when focus leaves the row, and keeps the old title for an empty one', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'צלם', 'אולם')
    await user.click(screen.getByRole('button', { name: 'עריכת המשימה צלם' }))
    await user.type(screen.getByRole('textbox', { name: 'עריכת המשימה' }), ' מגנטים')
    await user.click(input())
    expect(titles()).toEqual(['צלם מגנטים', 'אולם'])

    await user.click(screen.getByRole('button', { name: 'עריכת המשימה אולם' }))
    await user.clear(screen.getByRole('textbox', { name: 'עריכת המשימה' }))
    await user.click(input())
    expect(titles()).toEqual(['צלם מגנטים', 'אולם'])
  })
})

describe('Tasks page — deleting and undo', () => {
  it('deletes, moves focus, and restores the task in place with its completion state', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'אולם', 'צלם', 'שמלה')
    await user.click(checkbox('צלם'))
    await user.click(screen.getByRole('button', { name: 'מחיקת המשימה צלם' }))

    expect(titles()).toEqual(['אולם', 'שמלה'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'מחיקת המשימה שמלה' }))
    expect(toast().getAttribute('role')).toBe('status')
    expect(toast().textContent).toContain('המשימה „צלם” נמחקה')
    expect(progressbar().getAttribute('aria-valuenow')).toBe('0')

    await user.click(within(toast()).getByRole('button', { name: 'ביטול' }))
    expect(titles()).toEqual(['אולם', 'צלם', 'שמלה'])
    expect(checkbox('צלם').checked).toBe(true)
    expect(document.activeElement).toBe(checkbox('צלם'))
    expect(toast()).toBeNull()
  })

  it('moves focus to the previous row, then to the composer, when deleting the last rows', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'אולם', 'צלם')
    await user.click(screen.getByRole('button', { name: 'מחיקת המשימה צלם' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'מחיקת המשימה אולם' }))
    await user.click(screen.getByRole('button', { name: 'מחיקת המשימה אולם' }))
    expect(document.activeElement).toBe(input())
    expect(screen.getByText('הרשימה שלכם מחכה')).toBeTruthy()
  })

  it('dismisses the toast after 6 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      seedTasks([{ id: 'a', title: 'אולם', done: false }])
      renderApp('/tasks')
      await user.click(screen.getByRole('button', { name: 'מחיקת המשימה אולם' }))
      act(() => vi.advanceTimersByTime(5900))
      expect(toast()).toBeTruthy()
      act(() => vi.advanceTimersByTime(200))
      expect(toast()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Tasks page — persistence', () => {
  it('restores tasks and their completion after a reload', async () => {
    const user = userEvent.setup()
    const first = renderApp('/tasks')
    await addTasks(user, 'אולם', 'צלם')
    await user.click(checkbox('אולם'))
    first.unmount()

    expect(JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY)).tasks.map(({ title, done }) => ({ title, done })))
      .toEqual([{ title: 'אולם', done: true }, { title: 'צלם', done: false }])
    renderApp('/tasks')
    expect(titles()).toEqual(['אולם', 'צלם'])
    expect(checkbox('אולם').checked).toBe(true)
    expect(progressbar().getAttribute('aria-valuenow')).toBe('50')
  })

  it('recovers from corrupted task data', () => {
    localStorage.setItem(TASKS_STORAGE_KEY, '{nope')
    renderApp('/tasks')
    expect(screen.getByText('הרשימה שלכם מחכה')).toBeTruthy()
  })

  it('never changes the calculator data', async () => {
    const user = userEvent.setup()
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify({ version: 1, event: { invitedGuests: '300' }, expenses: [] }))
    const before = localStorage.getItem(BUDGET_STORAGE_KEY)
    renderApp('/tasks')
    await addTasks(user, 'אולם')
    await user.click(checkbox('אולם'))
    expect(localStorage.getItem(BUDGET_STORAGE_KEY)).toBe(before)
  })
})

describe('Tasks page — accessibility', () => {
  it('has one h1, a main region and labelled controls', async () => {
    const user = userEvent.setup()
    renderApp('/tasks')
    await addTasks(user, 'אולם')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main').id).toBe('main-content')
    document.querySelectorAll('main input, main button').forEach((el) => {
      const name = el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.textContent.trim()
      expect(name, `unnamed control ${el.outerHTML.slice(0, 60)}`).toBeTruthy()
    })
  })
})
