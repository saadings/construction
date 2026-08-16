import convexPlugin from '@convex-dev/eslint-plugin'
import js from '@eslint/js'
import { tanstackConfig } from '@tanstack/eslint-config'
import reactHooks from 'eslint-plugin-react-hooks'
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
      // The gallery's own build. Ignored beside the app's for the same reason and not for a different one: linting a bundle reports a parsing error about a file nobody wrote.
      'frontend/dist-gallery',
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
  // The rules of hooks, which nothing here was checking. A custom hook named `whileSending` rather than `useWhileSending` passed every check this repository has and then crashed a screen in a real browser: the React Compiler builds the app and the gallery, treats a function not named as a hook as an ordinary call, and the screen died with "Rendered fewer hooks than expected" on a destructive control.

  // Nothing could see it. Vitest compiles without that plugin, so every test ran against source the app does not ship -- and the crash appeared only in a browser, on the second tap of a confirmation nothing had ever photographed.

  // Two rules rather than the whole recommended set. The rest of it is React 19's compiler lint, and `set-state-in-effect` alone reports three places that work: `use-mobile`, `longerThan` and the invites route. They are worth their own change with their own reading; turning them on inside a crash fix would bury the fix.
  {
    files: ['frontend/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // The two that decide whether the compiler can read this code at all. `rules-of-hooks` is the one that would have caught the crash: it refuses a hook called from a function that is neither a component nor a hook.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
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
