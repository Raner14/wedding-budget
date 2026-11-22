/**
 * Decides what the summary (and the mobile balance bar) should show.
 * Pure — shared by both components so they can never disagree.
 */

export const STATUS = {
  profit: { label: 'רווח צפוי', icon: 'up' },
  loss: { label: 'הפסד צפוי', icon: 'down' },
  even: { label: 'מאוזן', icon: 'even' },
}

/**
 * @param {import('../../lib/validation.js').ParsedBudget} parsed
 * @param {object | null} lastValidValues
 * @returns {{ kind: 'result' | 'empty' | 'error', values: object | null, stale: boolean }}
 *   - result: `values` are current (stale=false) or the last valid ones while fields are invalid (stale=true)
 *   - empty:  nothing entered yet
 *   - error:  invalid input and no earlier valid result to show
 */
export function summaryView(parsed, lastValidValues) {
  if (parsed.errorCount > 0) {
    return lastValidValues
      ? { kind: 'result', values: lastValidValues, stale: true }
      : { kind: 'error', values: null, stale: false }
  }
  if (parsed.isEmpty) return { kind: 'empty', values: null, stale: false }
  return { kind: 'result', values: parsed.values, stale: false }
}
