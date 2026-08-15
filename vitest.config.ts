/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Two halves, two runtimes: this was `environmentMatchGlobs`, which vitest 4 removed and then silently ignored.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Projects inherit neither, and losing the scenario exclusion pulls the git-shelling suites into every `yarn test`.
  const shared = { env, exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/*.scenario.test.ts'] }

  // The same alias the app builds with. Without it here, a module the frontend imports resolves in the browser and not under test.
  const resolve = {
    alias: {
      '~shared': fileURLToPath(new URL('./shared', import.meta.url)),
      // What shadcn's own components import themselves by. Declared in both tsconfigs already, so this is that same mapping said where the test runner can read it rather than a second convention.
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
    },
  }

  return {
    resolve,
    test: {
      projects: [
        { test: { ...shared, name: 'convex', include: ['convex/**/*.test.ts'], environment: 'edge-runtime' } },
        {
          resolve,
          test: { ...shared, name: 'frontend', include: ['frontend/**/*.test.{ts,tsx}'], environment: 'jsdom' },
        },
        // Plain node: this half runs on both sides, so it must not depend on anything either runtime provides.
        { test: { ...shared, name: 'shared', include: ['shared/**/*.test.ts'], environment: 'node' } },
      ],
    },
  }
})
