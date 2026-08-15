import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { warnIfGeneratedTypesAreMissing } from '../scripts/generatedTypes'

// The defect this exists for was a wiring defect: the words were right and lived in one place instead of three.

// So the assertion that matters is the floor below. Two call sites out of three is exactly the bug, which is why it has to fail on two rather than only on none.

/** Everything written to stderr while something runs, since that is where a warning belongs and stdout is what the scripts print. */
function stderrWhile(run: () => void): string {
  const said: Array<string> = []
  const wrote = process.stderr.write.bind(process.stderr)

  process.stderr.write = (chunk: string | Uint8Array) => {
    said.push(String(chunk))
    return true
  }

  try {
    run()
  } finally {
    process.stderr.write = wrote
  }

  return said.join('')
}

describe('what is said when the Convex types are not there', () => {
  it('names why a build and a typecheck both fail for a reason that is not the code', () => {
    const nowhere = join(mkdtempSync(join(tmpdir(), 'generated-')), 'api.d.ts')

    const said = stderrWhile(() => warnIfGeneratedTypesAreMissing(nowhere))

    expect(said).toContain('convex/_generated IS NOT THERE')
    expect(said).toContain('Neither is a fault in the code you are reading')
    expect(said).toContain('npx convex codegen')
  })

  it('says nothing at all when they are there', () => {
    const there = join(mkdtempSync(join(tmpdir(), 'generated-')), 'api.d.ts')
    writeFileSync(there, 'export declare const api: unknown\n')

    expect(stderrWhile(() => warnIfGeneratedTypesAreMissing(there))).toBe('')
  })
})

describe('everywhere it has to be wired', () => {
  const root = join(import.meta.dirname, '..')
  const CALLS = 'generatedTypes.ts'

  it('is invoked by the build, the typecheck and the commit gate, all three', () => {
    // The floor. The words being right and existing somewhere is what #12 already had; being reached from every place that needs them is the fix.
    const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const hook = readFileSync(join(root, '.husky', 'pre-commit'), 'utf8')

    const wiredInto = [
      ['build', scripts.scripts.build ?? ''],
      ['typecheck', scripts.scripts.typecheck ?? ''],
      ['pre-commit', hook],
    ].filter(([, text]) => text.includes(CALLS))

    expect(
      wiredInto.map(([where]) => where),
      'a reviewer building for the first time gets an unresolved import and no cause from wherever this is missing'
    ).toEqual(['build', 'typecheck', 'pre-commit'])
  })

  it('is the same words in all three, because they come from one file', () => {
    // The control on the floor above: three call sites pointing at three copies of the message would satisfy it and be the drift this avoids.
    const wording = readFileSync(join(root, 'scripts', 'generatedTypes.ts'), 'utf8')

    expect(wording).toContain('IS NOT THERE')
    expect(wording).toContain('COULD NOT REGENERATE')

    const hook = readFileSync(join(root, '.husky', 'pre-commit'), 'utf8')
    expect(hook).not.toContain('COULD NOT REGENERATE')
  })
})
