/**
 * Maps a free-text Hebrew (or English) expense name to a decorative icon key.
 * Purely visual: the icon never affects calculations.
 */
const RULES = [
  ['music', /די.?ג|dj|מוזיק|להק|זמר/i],
  ['camera', /צלם|צילום|וידאו|מגנט|סטילס/i],
  ['dress', /שמל|חליפ|איפור|שיער|תכשיט/i],
  ['flower', /פרח|עיצוב|זר|קישוט/i],
  ['mail', /הזמנ|דפוס/i],
  ['car', /הסע|רכב|אוטובוס|נסיע/i],
]

/**
 * @param {string} name
 * @returns {'music'|'camera'|'dress'|'flower'|'mail'|'car'|'sparkle'}
 */
export function expenseIconKey(name) {
  for (const [key, pattern] of RULES) if (pattern.test(name)) return key
  return 'sparkle'
}
