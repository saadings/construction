// @vitest-environment node
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { everyScreen } from './screens'

// The floor under six other floors. Every guard that reads source now walks this one sweep, so this is the file that has to fail if the sweep stops seeing the app -- because none of the six would.
const SOURCE = join(dirname(new URL(import.meta.url).pathname), '..')

describe('the sweep every guard walks', () => {
  const screens = everyScreen()

  it('opens the app rather than a count of it', () => {
    // Named files rather than a number, because a number is satisfied by any thirty files and these are the ones the guards are about.
    const paths = screens.map(({ path }) => path)

    expect(paths).toContain('components/site/Stages.tsx')
    expect(paths).toContain('components/form/Pick.tsx')
    expect(paths).toContain('routes/sites.$siteId.day.tsx')
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

  it('refuses a directory with no screens in it rather than reporting a clean app', () => {
    // Exercised against a real directory that really holds no `.tsx`: this file's own. Without this the refusal is a line no test reaches, which is the shape of guard this repository has been caught by before.
    expect(() => everyScreen(join(SOURCE, 'testing'))).toThrow(/never opened/)
  })
})
