import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// `columns.ts` hands each of its questions to the browser as a string, deliberately: the probe runs in a page and the file stays a Node script with no DOM types in it. So every probe is a template literal, and a template literal is read by Node before the browser ever sees it.

// Which makes `${...}` inside one ambiguous in a way nothing else in this repository is. Injecting a Node-side constant is the point and it is done twenty-eight times -- `${String(A_THUMB_NEEDS)}` puts a number into the page. Writing `${el.offsetWidth}` looks like browser code and is evaluated by Node at definition time, against a variable that does not exist there.

// The typecheck cannot see the difference, because both are valid TypeScript in a template literal. Neither can a person writing the probe: the mistake happens in the substrate while attention is on the code, which is the same reason a wrapped comment and a piped exit code get past somebody being careful.

// So the rule is about shape rather than presence. Every interpolation must be a named constant handed in, and anything else is a bug by construction rather than a bug somebody has to notice.

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

const ONLY_A_CONSTANT = /^\$\{String\([A-Z][A-Z_0-9]*\)\}$/

/** Each probe as it is written: the name it is bound to, and the text handed to the page. */

// Read line by line between its two markers rather than by one expression over the whole file. A single pattern with a lazy middle ran past a probe's end and swallowed the prose after it, so the bodies held backticks that no probe contains -- and it was this file's own floor that said so rather than anything about the probes.
function everyProbe(): Array<{ name: string; body: string }> {
  const lines = readFileSync(join(repoRoot, 'scripts/columns.ts'), 'utf8').split('\n')
  const probes: Array<{ name: string; body: string }> = []

  let name: string | null = null
  let body: Array<string> = []

  for (const line of lines) {
    const opens = /^const ([A-Z_]+) = `\(\(\) => \{$/.exec(line)

    if (opens) {
      name = opens[1]
      body = []
      continue
    }

    if (name === null) continue

    if (line === '})()`') {
      probes.push({ name, body: body.join('\n') })
      name = null
      continue
    }

    body.push(line)
  }

  return probes
}

function everyInterpolationIn(body: string): Array<string> {
  return [...body.matchAll(/\$\{[^}]*\}/g)].map((found) => found[0])
}

describe('what a probe handed to the page may interpolate', () => {
  const probes = everyProbe()

  it('finds the probes at all, so an empty answer below would be a broken matcher', () => {
    // The floor. A pattern that stopped matching reports exactly what a file with no bad interpolation reports.
    expect(probes.length).toBeGreaterThanOrEqual(8)
  })

  it('finds the interpolations inside them, which is the other half of the same floor', () => {
    // And this is the half that would go quiet first: the probes could still be found while the search inside them found nothing.

    // Four rather than the thirty the file holds, and the difference is the point: nearly every `${...}` in `columns.ts` is ordinary TypeScript building a message, and only the ones inside a probe cross the wire. A floor taken from the file-wide count would have been a floor over the wrong subject.
    const found = probes.flatMap((probe) => everyInterpolationIn(probe.body))

    expect(found.length).toBeGreaterThanOrEqual(4)
  })

  it('interpolates nothing but a named constant', () => {
    const wrong = probes.flatMap((probe) =>
      everyInterpolationIn(probe.body)
        .filter((said) => !ONLY_A_CONSTANT.test(said))
        .map((said) => `${probe.name}: ${said}`)
    )

    // Anything else is browser code that Node has already run, against names that do not exist on this side of the wire.
    expect(wrong).toEqual([])
  })

  it('holds no unescaped backtick, which would end the probe early and take the rest of it with it', () => {
    // The other way the substrate bites: a bare backtick inside one of these closes the string and everything after it becomes TypeScript.

    // Escaped ones are allowed and there are dozens, because the probes explain themselves in prose and that prose quotes code. The escape is exactly what makes them safe -- the page receives a backtick inside a comment and nothing has ended early. So the rule is about the escape rather than the character, and a first version that banned the character was wrong about every one of them.
    const withOne = probes.filter((probe) => /(?<!\\)`/.test(probe.body)).map((probe) => probe.name)

    expect(withOne).toEqual([])
  })
})
