/// <reference types="vitest" />
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Two halves, two runtimes: this was `environmentMatchGlobs`, which vitest 4 removed and then silently ignored.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Projects inherit neither, and losing the scenario exclusion pulls the git-shelling suites into every `yarn test`.
  const shared = { env, exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/*.scenario.test.ts'] }

  return {
    test: {
      projects: [
        { test: { ...shared, name: 'convex', include: ['convex/**/*.test.ts'], environment: 'edge-runtime' } },
        { test: { ...shared, name: 'frontend', include: ['frontend/**/*.test.{ts,tsx}'], environment: 'jsdom' } },
        // Plain node: this half runs on both sides, so it must not depend on anything either runtime provides.
        { test: { ...shared, name: 'shared', include: ['shared/**/*.test.ts'], environment: 'node' } },
      ],
    },
  }
})
