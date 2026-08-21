// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { everyScreen } from './screens'

// The floor under eight other floors. Every guard that reads source now walks this one sweep, so this is the file that has to fail if the sweep stops seeing the app -- because none of the eight would.
const SOURCE = join(dirname(new URL(import.meta.url).pathname), '..')

/** Where this file itself is, since the rule below is about every call site except this one. */
const ITSELF = 'testing/screens.test.ts'

// A call with anything inside the brackets, which is the only way a guard can narrow its own sweep. Written as "not immediately closed" rather than as a list of what could be passed, because the next way to narrow it has not been thought of yet.
const NARROWED = /everyScreen\(\s*[^)\s]/

// The guards are `.test.ts` and the sweep takes only `.tsx`, so `everyScreen` cannot be used to find its own callers. That asymmetry is why this reads the tree itself rather than reusing the thing it is guarding -- and it is also the reason the rule is worth writing down: a comment saying "never narrow this at a call site" is exactly the remembered floor the sweep exists to abolish.
function everyFileUnder(dir: string): Array<{ path: string; source: string }> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return everyFileUnder(path)

    return /\.tsx?$/.test(path) ? [{ path: relative(SOURCE, path), source: readFileSync(path, 'utf8') }] : []
  })
}

describe('the sweep every guard walks', () => {
  const screens = everyScreen()

  it('opens the app rather than a count of it', () => {
    // Named files rather than a number, because a number is satisfied by any thirty files and these are the ones the guards are about.
    const paths = screens.map(({ path }) => path)

    expect(paths).toContain('components/site/Stages.tsx')
    expect(paths).toContain('components/form/Pick.tsx')
    expect(paths).toContain('routes/sites.$siteId.daybook.tsx')
    expect(screens.length).toBeGreaterThan(30)
  })

  it('reads what is written in them, not only their names', () => {
    // A sweep handing back empty strings would satisfy every "contains no forbidden tag" guard in the repository.
    const pick = screens.find(({ path }) => path === 'components/form/Pick.tsx')

    expect(pick?.source).toContain('export function Pick(')
  })

  it('goes down into the directories the app is written in', () => {
    expect(screens.some(({ path }) => path.split('/').length >= 3)).toBe(true)
  })

  it('leaves out the tests of screens, so a guard never reads its own plants as the app', () => {
    expect(screens.filter(({ path }) => path.endsWith('.test.tsx'))).toEqual([])
  })

  it('is called bare by every guard that stands on it', () => {
    // `under` exists so the refusal below can be exercised against a real directory that really has no screens. That same argument is the one thing that could quietly narrow a guard's sweep, so the only file allowed to pass it is this one.
    const files = everyFileUnder(SOURCE).filter(({ path }) => path !== ITSELF && path !== 'testing/screens.ts')

    const narrowed = files
      .filter(({ source }) => NARROWED.test(source))
      .map(({ path }) => `${path}: everyScreen is given a directory, which narrows what that guard sweeps`)

    expect(narrowed).toEqual([])
  })

  it('is asked of the guards that really call it, and would notice one narrowing it', () => {
    // The floor. A read that stopped finding callers reports the same clean result as an app where every one of them calls it bare.
    const callers = everyFileUnder(SOURCE)
      .filter(({ path, source }) => path !== 'testing/screens.ts' && /\beveryScreen\(/.test(source))
      .map(({ path }) => path)

    expect(callers).toContain('contrast.test.ts')
    expect(callers).toContain('routes/waitingIsNotAnAnswer.test.ts')
    expect(callers.length).toBeGreaterThan(7)

    // And the shape it is looking for, since every real call site is bare and none of them can demonstrate the failure.
    expect(NARROWED.test('const screens = everyScreen(join(SOURCE, "components"))')).toBe(true)
    expect(NARROWED.test("const screens = everyScreen('/somewhere')")).toBe(true)
    expect(NARROWED.test('const screens = everyScreen()')).toBe(false)
    expect(NARROWED.test('const screens = everyScreen(\n)')).toBe(false)
  })

  it('refuses a directory with no screens in it rather than reporting a clean app', () => {
    // Exercised against a real directory that really holds no `.tsx`: this file's own. Without this the refusal is a line no test reaches, which is the shape of guard this repository has been caught by before.
    expect(() => everyScreen(join(SOURCE, 'testing'))).toThrow(/never opened/)
  })
})
