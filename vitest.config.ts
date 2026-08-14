/// <reference types="vitest" />
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    test: {
      env,
      // Exclude slow scenario tests from the default `yarn test` / CI runs
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.scenario.test.ts'],
      // Use edge-runtime for convex tests, jsdom for other tests
      environmentMatchGlobs: [['convex/**', 'edge-runtime']],
    },
  }
})
