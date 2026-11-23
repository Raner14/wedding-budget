import { BUDGET_STORAGE_KEY, LEGACY_BUDGET_STORAGE_KEY } from '../lib/budgetStorage.js'

// Built from char codes so the source stays ASCII-only (no invisible characters).
const BIDI_MARKS = new RegExp(`[${String.fromCharCode(0x200e, 0x200f, 0x061c)}]`, 'g')
const NBSP = new RegExp(`[${String.fromCharCode(0x00a0, 0x202f)}]`, 'g')

/** Removes bidi marks and non-breaking spaces that Intl adds around currency amounts. */
export const normalize = (text) => String(text ?? '').replace(BIDI_MARKS, '').replace(NBSP, ' ').trim()

const EVENT_DEFAULTS = {
  invitedGuests: '', attendanceRate: '85', mealPrice: '', minimumMeals: '',
  reserveMeals: '', reserveMealPrice: '', averageGift: '',
}

const SAMPLE_EXPENSES = [
  { id: 'dj', name: 'די-ג׳יי', amount: '6,000' },
  { id: 'photographer', name: 'צלם', amount: '9,000' },
  { id: 'dress', name: 'שמלת כלה', amount: '8,000' },
  { id: 'flowers', name: 'עיצוב ופרחים', amount: '7,000' },
]

/** The approved prototype's sample budgets (also covered by the budget.js regression tests). */
export const SAMPLES = {
  profit: { event: { invitedGuests: '300', attendanceRate: '85', mealPrice: '350', minimumMeals: '250', averageGift: '505' }, expenses: SAMPLE_EXPENSES },
  loss: { event: { invitedGuests: '300', attendanceRate: '70', mealPrice: '380', minimumMeals: '250', reserveMeals: '10', reserveMealPrice: '200', averageGift: '450' }, expenses: SAMPLE_EXPENSES },
  zero: { event: { invitedGuests: '0', attendanceRate: '85', mealPrice: '350', minimumMeals: '250', averageGift: '450' }, expenses: SAMPLE_EXPENSES },
}

/**
 * Writes a budget exactly as the published version 1 site saved it (legacy key and
 * format), so every test that seeds data also exercises the v1 → v2 migration.
 */
export function seedBudget({ event = {}, expenses = [] } = {}) {
  localStorage.setItem(LEGACY_BUDGET_STORAGE_KEY, JSON.stringify({ version: 1, event: { ...EVENT_DEFAULTS, ...event }, expenses }))
}

const EVENT_DEFAULTS_V2 = {
  invitedGuests: '', attendanceRate: '85', mealPrice: '', minimumMeals: '', averageGift: '',
  reserveModel: 'as-needed', reserveAvailable: '', reserveGuests: '', reserveMealPrice: '', reserveGift: '',
}

/** Writes a budget in the current (version 2) format. */
export function seedBudgetV2({ event = {}, expenses = [], familyGifts = { enabled: false, items: [] }, notices = { reserveMigrated: false } } = {}) {
  localStorage.setItem(
    BUDGET_STORAGE_KEY,
    JSON.stringify({ version: 2, event: { ...EVENT_DEFAULTS_V2, ...event }, expenses, familyGifts, notices }),
  )
}
