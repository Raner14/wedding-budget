/**
 * Approved typography: Frank Ruhl Libre (headings) and Heebo (text).
 * Loaded from JS instead of a <link> in index.html so the stylesheet does not block
 * the first paint; `display=swap` shows fallback fonts until the web fonts arrive.
 * Only the weights actually used by the CSS are requested.
 */
export const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@400;500;600;700&display=swap'

export function loadFonts(doc = document) {
  // A fixed marker attribute (URL attribute selectors are fragile in some DOM engines).
  if (doc.querySelector('link[data-app-fonts]')) return
  const link = doc.createElement('link')
  link.rel = 'stylesheet'
  link.href = FONTS_URL
  link.dataset.appFonts = ''
  doc.head.appendChild(link)
}
