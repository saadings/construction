/// <reference types="vitest" />
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Tests whose subject is the repository itself rather than anything the app does; kept apart because they shell out to git.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    test: {
      testTimeout: 30_000,
      env,
      // ONLY include scenario tests
      include: ['**/*.scenario.test.ts'],
      // `.claude/worktrees/` holds another branch's checkout: left in, every scenario runs twice, the second time against work not in this commit.
      exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    },
  }
})
