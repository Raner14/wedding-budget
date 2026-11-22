/**
 * Motion helpers. When the environment cannot tell us (e.g. tests, very old
 * browsers), we assume reduced motion so nothing is hidden or delayed.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Entrance animations need both motion permission and IntersectionObserver. */
export function canAnimateEntrances() {
  return !prefersReducedMotion() && typeof window.IntersectionObserver === 'function'
}
