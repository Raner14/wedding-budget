import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest globals are disabled, so Testing Library cannot register its own cleanup.
// Pure lib tests run in the "node" environment, where there is no DOM or localStorage.
afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
  globalThis.localStorage?.clear()
})
