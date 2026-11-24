import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Tests must not depend on a developer's local .env, so Google sign-in
// starts unconfigured. Tests that need it set their own client ID.
beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
})

// Cleans up rendered components and any stored login after each test.
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
})