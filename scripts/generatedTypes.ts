#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// `api.d.ts` names every function, so its absence is the only reading that means anything. `dataModel.d.ts` never names a table, so testing it can only ever answer "absent".
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = join(root, 'convex', '_generated', 'api.d.ts')

// One place these words live, said the same by the commit gate, the build and the typecheck.
function saySo(headline: string, whatItMeans: Array<string>): void {
  process.stderr.write(
    [
      '',
      `  !!  ${headline}  !!`,
      '',
      ...whatItMeans.map((line: string) => `  ${line}`),
      '',
      "  Run 'npx convex codegen' against a linked deployment, or set CONVEX_DEPLOYMENT.",
      '',
      '',
    ].join('\n')
  )
}

// Printed, never fatal. Whatever was going to happen still happens, with the cause said first instead of an unresolved import naming a path and no reason.
export function warnIfGeneratedTypesAreMissing() {
  if (existsSync(API)) {
    return
  }

  saySo('convex/_generated IS NOT THERE', [
    'Nothing below has the Convex types to check against, so a build fails on an',
    'import it cannot resolve and a typecheck fails on functions it cannot find.',
    'Neither is a fault in the code you are reading.',
  ])
}

export function warnThatGeneratedTypesAreStale() {
  saySo('COULD NOT REGENERATE convex/_generated', [
    'The generated Convex types are whatever they were before this commit.',
    'If a table or function changed since they were written, everything below is',
    "checking the wrong types: db reads come back as 'any', so a green typecheck",
    'proves nothing and a red one may not be your fault.',
    '',
    'Trust CI over this run.',
  ])
}

const [, , asked] = process.argv
if (asked === 'stale') {
  warnThatGeneratedTypesAreStale()
} else {
  warnIfGeneratedTypesAreMissing()
}
