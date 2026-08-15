import convexPlugin from '@convex-dev/eslint-plugin'
import js from '@eslint/js'
import { tanstackConfig } from '@tanstack/eslint-config'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import { singleLineComments } from './eslint-rules/singleLineComments'

const local = { rules: { 'single-line-comments': singleLineComments } }

export default defineConfig([
  {
    // `.claude` holds another branch's whole checkout: linted, it reports that branch's problems as this one's. `components/ui` is shadcn's own, copied in by their CLI and updated the same way: held to our rules it reports their style as this repository's problems, and editing it to agree is how you come to maintain a fork of somebody else's component.
    ignores: [
      'dist',
      'frontend/dist',
      'convex/_generated',
      '.yarn',
      '.agents',
      '.claude',
      'frontend/src/components/ui/**',
    ],
  },
  {
    // Reported as you type, in TypeScript only; the scenario suite covers YAML, shell and CSS as well.
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    ignores: ['frontend/src/routeTree.gen.ts'],
    plugins: { local },
    rules: { 'local/single-line-comments': 'error' },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    ignores: ['frontend/**'],
    plugins: { js },
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  tseslint.configs.recommended,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ...convexPlugin.configs.recommended,
  ...tanstackConfig.map((config) => ({
    ...config,
    files: ['frontend/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...((config.languageOptions as Record<string, unknown>)?.parserOptions as Record<string, unknown>),
        project: undefined,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),
  {
    files: ['frontend/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
])
