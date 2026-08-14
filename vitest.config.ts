/// <reference types="vitest" />
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * The two halves of this app run in different places, so their tests do too:
 * Convex functions on the edge runtime, the frontend in a browser.
 *
 * This was `environmentMatchGlobs`, which vitest 4 removed. It was accepted
 * and ignored, no top-level environment was set, and everything ran in Node —
 * which the whole suite survived only because every test that needed something
 * else carried its own `@vitest-environment` docblock. A frontend test written
 * without one fails loudly on `document`; a Convex test written without one
 * passes while exercising Node's globals rather than the runtime the
 * deployment uses. The two environment probes are what hold this honest.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Projects inherit neither of these, and losing the scenario exclusion would
  // pull the suites that shell out to git into every `yarn test`.
  const shared = { env, exclude: ['**/node_modules/**', '**/dist/**', '**/*.scenario.test.ts'] }

  return {
    test: {
      projects: [
        { test: { ...shared, name: 'convex', include: ['convex/**/*.test.ts'], environment: 'edge-runtime' } },
        { test: { ...shared, name: 'frontend', include: ['frontend/**/*.test.{ts,tsx}'], environment: 'jsdom' } },
      ],
    },
  }
})
