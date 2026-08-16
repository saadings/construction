import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Linter } from 'eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { describe, expect, it } from 'vitest'

// A function that calls hooks and is not named like one. `whileSending()` in `ChangeTheContract` held two `useState`s and read as an ordinary call to everything in this repository -- 218 green tests over a screen that died in a browser on the second tap of "Cancel this contract" with "Rendered fewer hooks than expected".

// The reason nothing saw it is the asymmetry this file pins down: the app and the gallery are built by the React Compiler, and vitest runs no react plugin at all. The suite was compiling a different program from the one anybody ships, and it was green about the one nobody ships.

// So the lint rule is the whole instrument. There is no test that can reproduce the crash, because the runtime that crashes is the one the tests do not use.

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** What the rule says about a source, in process rather than about a file on disk: a probe written under `frontend/` is inside tsconfig, and a concurrent typecheck fails on it while it exists. */
function complaintsAbout(source: string): number {
  const linter = new Linter()

  const reported = linter.verify(source, {
    plugins: { local: { rules: { 'rules-of-hooks': reactHooks.rules['rules-of-hooks'] } } },
    rules: { 'local/rules-of-hooks': 'error' },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  })

  return reported.filter((message) => message.ruleId === 'local/rules-of-hooks').length
}

/** Verbatim in the shape it shipped in, minus the types: two `useState`s in a function whose name does not begin with `use`. */
const AS_IT_SHIPPED = `
import { useState } from 'react'
function whileSending() {
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState(null)
  return { saving, refusal, setSaving, setRefusal }
}
export const it = whileSending
`

const AS_IT_IS_NOW = AS_IT_SHIPPED.replaceAll('whileSending', 'useWhileSending')

describe('a hook the compiler cannot tell is one', () => {
  it('is what the rule complains about', () => {
    // Both `useState` calls, which is the crash: the compiler treats the call site as ordinary code and the component ends up with a hook count that changes between renders.
    expect(complaintsAbout(AS_IT_SHIPPED)).toBe(2)
  })

  it('is not what a hook named like one is', () => {
    // The control. Without it the check above is met by a rule that complains about everything, and by a linter that failed to parse.
    expect(complaintsAbout(AS_IT_IS_NOW)).toBe(0)
  })

  it('is a rule this repository really loads, rather than one only this test knows about', () => {
    // Verifying a rule in process says nothing about whether eslint is configured to run it over the frontend.
    const config = readFileSync(join(repoRoot, 'eslint.config.ts'), 'utf8')

    expect(config).toContain("'react-hooks/rules-of-hooks': 'error'")
    expect(config).toContain("plugins: { 'react-hooks': reactHooks }")
  })
})

/** What a config file says it builds with, read off the disk rather than off a memory of it. */
function buildConfig(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('what compiles this app', () => {
  it('is the React Compiler, wherever anybody actually looks at the app', () => {
    expect(buildConfig('frontend/vite.config.ts')).toContain('babel-plugin-react-compiler')
    expect(buildConfig('frontend/vite.gallery.config.ts')).toContain('babel-plugin-react-compiler')
  })

  it('is not the React Compiler under vitest, which is why the lint rule is the only instrument', () => {
    // Not a thing to fix by adding the plugin here: `@vitejs/plugin-react` under vitest would compile the tests too, and the point of this test is that the difference exists rather than that it should not.
    const underTest = buildConfig('vitest.config.ts')

    expect(underTest).not.toContain('babel-plugin-react-compiler')
    expect(underTest).not.toContain('@vitejs/plugin-react')
  })
})
