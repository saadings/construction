/// <reference types="vitest" />
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Scenario tests: the ones that exercise something whole rather than a
 * function — a signed request travelling through the real HTTP router, the
 * repository as git actually sees it, the environment file as someone
 * following it would.
 *
 * They are kept out of `yarn test` because they read git history and reach
 * across the whole tree, which is a different kind of run from a unit test,
 * not because they are slow. `yarn test:scenario` runs them, and so does CI
 * and the pre-commit hook — a check nobody runs protects nothing.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    test: {
      testTimeout: 30_000,
      env,
      // ONLY include scenario tests
      include: ['**/*.scenario.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  }
})
