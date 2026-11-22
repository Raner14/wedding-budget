/**
 * Hebrew (he-IL) number formatting. Formatters are created once per module:
 * constructing Intl.NumberFormat is comparatively expensive.
 *
 * Note: Intl may insert invisible bidi marks (e.g. U+200F) around the currency
 * sign. Callers render amounts inside <bdi> so they display correctly in RTL.
 */

const moneyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('he-IL', {
  maximumFractionDigits: 0,
})

/**
 * Formats whole shekels, e.g. 9525 → "‏9,525 ₪". Fractions are rounded for display only.
 * @param {number} amount
 * @returns {string}
 */
export function formatMoney(amount) {
  return moneyFormatter.format(amount)
}

/**
 * Formats a count with thousands separators, e.g. 1234 → "1,234".
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return numberFormatter.format(value)
}
