/// <reference types="vitest" />
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Scenario tests: the ones whose subject is the repository itself rather than
 * anything the app does — git history and what it has ever carried, the
 * environment file as someone following it would, the workflow as GitHub will
 * read it.
 *
 * They are kept out of `yarn test` because they shell out to git and reach
 * across the whole tree, which is a different kind of run from a test of the
 * app, not because they are slow. Anything that exercises the app itself —
 * including a signed request through the real HTTP router — belongs in
 * `yarn test`, where it is run far more often.
 *
 * `yarn test:scenario` runs these, and so does CI and the pre-commit hook — a
 * check nobody runs protects nothing.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    test: {
      testTimeout: 30_000,
      env,
      // ONLY include scenario tests
      include: ['**/*.scenario.test.ts'],
      // `.claude/worktrees/` holds a checkout of some other branch. Left in,
      // every scenario runs twice — once against this tree and once against
      // work that is not in this commit — so a run goes red or green on
      // somebody else's changes.
      exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    },
  }
})
