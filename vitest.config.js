import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  test: {
    // Simulates a browser environment for React tests.
    environment: 'jsdom',

    // Makes functions like describe, test, and expect available.
    globals: true,

    // Runs this setup file before each test file.
    setupFiles: ['./src/test/setup.js'],

    // Enables test coverage reporting when requested.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})