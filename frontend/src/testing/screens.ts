import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

// The sweep every guard that reads source walks. It was written out five times, identically, in five test files -- and a guard's floor is only ever as good as the sweep under it: a sweep that has quietly stopped opening files reports exactly what an app with nothing wrong in it reports.

/** Where this app's screens are. */
const SOURCE = join(dirname(new URL(import.meta.url).pathname), '..')

/** A screen and the text of it, named the way somebody would name it out loud: `components/site/Stages.tsx`. */
export type Screen = { path: string; source: string }

function everyTsxUnder(dir: string): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return everyTsxUnder(path)

    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : []
  })
}

// Refuses to come back empty. Six guards now stand on this one sweep, and the failure that would matter is not one of them going wrong -- it is this returning nothing and all six going green together, on an app none of them opened.

// Every guard calls this with nothing. `under` is here so that refusal can be exercised against a real directory that really has no screens in it, rather than being a line no test can reach without first editing the thing it guards. Narrowing it at a call site would narrow that guard's sweep, which is what this file exists to stop.

/** Every screen this app writes, tests of them left out. */
export function everyScreen(under: string = SOURCE): Array<Screen> {
  const found = everyTsxUnder(under).map((path) => ({
    path: relative(under, path),
    source: readFileSync(path, 'utf8'),
  }))

  if (found.length === 0) {
    throw new Error(`No screens under ${under}. Every guard reading source would pass on an app it never opened.`)
  }

  return found
}
