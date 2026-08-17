// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../testing/screens'
import { withoutComments } from '../testing/source'

// A component that takes a `className` and joins it to its own with a template string has not taken it. Both class lists reach the page, both set the same properties, they have equal specificity, and **which one wins is decided by the order Tailwind happens to emit them in**.

// `SitesList` had it. `StartOne` said `inline-flex` and its caller said `hidden sm:inline-flex`, so at 390 there were two `Start a house` controls on the screen -- the full one meant for a desk sitting under the round one meant for a thumb. It was in every picture of that screen from the day it was drawn, which is the other half of the lesson: **a passing sweep is a reason people stop opening the pictures.**

// `cn` is tailwind-merge, which knows `hidden` and `inline-flex` are one property and keeps the one the caller asked for. This is not a style preference: it is the difference between a prop that is honoured and a prop that is a suggestion.

/** A `className` handed into a class list by joining strings rather than by merging them. */
export function joinedRatherThanMerged(source: string): Array<string> {
  const written = withoutComments(source)

  // Anchored on the interpolation inside a template literal that is being used as a class list, which is the shape that loses. `cn(..., className)` passes a value to a function that resolves the conflict; `${className}` inside backticks hands the browser two answers.
  return [...written.matchAll(/className=\{`[^`]*\$\{\s*(?:className|[\w.]*\bclassName)\b[^`]*`\}/g)].map((found) =>
    found[0].replace(/\s+/g, ' ').slice(0, 80)
  )
}

describe('a class list a caller hands in', () => {
  const screens = everyScreen()

  it('is merged rather than joined, so the caller decides', () => {
    const joined = screens.filter(({ source }) => joinedRatherThanMerged(source).length > 0).map(({ path }) => path)

    expect(joined).toEqual([])
  })

  it('would notice one written tomorrow, rather than matching nothing at all', () => {
    // The control on the matcher. A regex that stopped matching reports exactly what an app where every component merges reports -- and this rule exists because one that did not was invisible for weeks.
    expect(joinedRatherThanMerged("className={`flex gap-2 ${className ?? ''}`}")).toHaveLength(1)
    expect(joinedRatherThanMerged('className={`flex gap-2 ${what}`}')).toHaveLength(0)
    expect(joinedRatherThanMerged("className={cn('flex gap-2', className)}")).toHaveLength(0)
  })

  it('is being asked of the screens, rather than of an empty list', () => {
    expect(screens.length).toBeGreaterThan(20)
    expect(screens.some(({ source }) => source.includes('className={cn('))).toBe(true)
  })
})
