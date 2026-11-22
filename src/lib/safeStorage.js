/**
 * localStorage access that never throws. Storage can be unavailable or throw
 * (private mode, blocked site data, quota exceeded); the app must keep working.
 */

/**
 * @param {string} key
 * @returns {unknown} The parsed JSON value, or null when missing/unreadable.
 */
export function readJSON(key) {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Whether localStorage can actually be written (it may exist but throw, e.g. in some private modes).
 * @returns {boolean}
 */
export function isStorageAvailable() {
  const probe = '__wedding_budget_probe__'
  try {
    globalThis.localStorage.setItem(probe, '1')
    globalThis.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} Whether the value was saved.
 */
export function writeJSON(key, value) {
  try {
    if (!globalThis.localStorage) return false
    globalThis.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
