// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DESTINATIONS } from '../components/shell/destinations'

// Read relative to this file rather than through git, because the commit gate runs the checks in a throwaway checkout where the repository root is somewhere else entirely.
const SOURCE = join(dirname(new URL(import.meta.url).pathname), '..')

// A link to a route that does not exist is a dead end, and nothing fails: the page renders, the tab is there, and the tap does nothing. It has happened twice already.
const ROUTE_TREE = readFileSync(join(SOURCE, 'routeTree.gen.ts'), 'utf8')

/** Every path the generated route tree declares, which is the only list that decides what a link can reach. */
function routesDeclared(): Array<string> {
  return [...ROUTE_TREE.matchAll(/'(\/[^']*)': typeof \w+/g)].map((found) => found[1])
}

function screenFiles(dir: string): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return screenFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

function everyLinkTarget(): Array<string> {
  const found = screenFiles(SOURCE).flatMap((path) =>
    [...readFileSync(path, 'utf8').matchAll(/\bto="([^"]+)"/g)].map((hit) => hit[1])
  )

  return [...new Set(found)]
}

describe('where the app says a person can go', () => {
  const declared = routesDeclared()

  it('is somewhere the router actually has', () => {
    const nowhere = everyLinkTarget().filter((target) => !declared.includes(target))

    expect(nowhere).toEqual([])
  })

  it('is measured against a route tree that really has routes, and links that really exist', () => {
    // The floor. An empty list of declared routes makes every link read as missing; an empty list of links makes the check above pass over nothing.
    expect(declared.length).toBeGreaterThan(3)
    expect(declared).toContain('/')
    expect(everyLinkTarget().length).toBeGreaterThan(2)
  })

  it('is true of every place in the nav as well, which is where a dead end is worst', () => {
    // A tab that goes nowhere is tapped by everybody, unlike a link buried in a screen.
    for (const destination of DESTINATIONS) {
      expect(declared, `${destination.label} points at ${destination.to}`).toContain(destination.to)
    }
  })
})
