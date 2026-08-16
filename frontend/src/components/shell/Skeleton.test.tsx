// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { Skeleton, WhileWaiting } from './Skeleton'

// The other end of the silence a send has. Convex holds a subscription open until it can answer, so a reading on a phone with no signal does not fail -- it stays `undefined`, and the grey bars pulse for as long as somebody stands there.

// Nineteen screens wait on something. All nineteen go through `WhileWaiting`, so the sentence is written once and none of them can forget it.

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const SAYS_SO = /has not come through yet/

describe('a reading that has not arrived', () => {
  it('says nothing while a screen is merely loading', () => {
    vi.useFakeTimers()
    render(
      <WhileWaiting what="What is owed">
        <Skeleton className="h-4 w-40" />
      </WhileWaiting>
    )

    // Six seconds in, this is an ordinary read on a slow connection, and a sentence here is one he learns to read past.
    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    expect(screen.queryByText(SAYS_SO)).toBeNull()
  })

  it('says so once the bars have been pulsing too long to be loading', () => {
    vi.useFakeTimers()
    render(
      <WhileWaiting what="What is owed">
        <Skeleton className="h-4 w-40" />
      </WhileWaiting>
    )

    act(() => {
      vi.advanceTimersByTime(13_000)
    })

    expect(screen.getByText(SAYS_SO)).toBeTruthy()
  })

  it('promises only what a subscription does, and never that anything went wrong', () => {
    // Nothing was typed, so nothing can be lost -- which is why this says less than the one a send shows. What it may say is that the reading is still open and fills in on its own.
    vi.useFakeTimers()
    render(
      <WhileWaiting what="What is owed">
        <Skeleton className="h-4 w-40" />
      </WhileWaiting>
    )
    act(() => {
      vi.advanceTimersByTime(13_000)
    })

    const said = screen.getByText(SAYS_SO).textContent

    expect(said).toContain('It will fill in as soon as it has')
    expect(said).not.toMatch(/failed|error|wrong|try again|lost/i)
  })

  it('keeps the shape of what is coming while it says it', () => {
    // The skeleton is a promise about what is arriving, and the sentence is beside it rather than instead of it: a screen that swaps grey bars for a line of text jumps twice instead of once.
    vi.useFakeTimers()
    render(
      <WhileWaiting what="What is owed">
        <Skeleton className="h-4 w-40" />
      </WhileWaiting>
    )
    act(() => {
      vi.advanceTimersByTime(13_000)
    })

    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(1)
  })
})

// Counted by region rather than by whether the file mentions `WhileWaiting` anywhere. The first version asked the second question, and a planted bare skeleton in a file that also had a proper one walked straight past it: a file-level answer to a per-skeleton question.

/** Every `<Skeleton` a file draws outside a `WhileWaiting`, which is a screen that pulses and never says why. */
export function skeletonsOutsideWaiting(source: string): number {
  let depth = 0
  let outside = 0

  for (const [found] of source.matchAll(/<WhileWaiting\b|<\/WhileWaiting>|<Skeleton\b/g)) {
    if (found === '<WhileWaiting') depth += 1
    else if (found === '</WhileWaiting>') depth = Math.max(0, depth - 1)
    else if (depth === 0) outside += 1
  }

  return outside
}

describe('every screen that waits on a reading', () => {
  const waiting = everyScreen().filter(
    ({ path, source }) => path.startsWith('components/') && source.includes('<WhileWaiting')
  )

  it('waits through the one place that says why it is still waiting', () => {
    // A screen drawing bare `Skeleton`s outside a `WhileWaiting` pulses silently however many proper ones it also has.
    const silent = everyScreen()
      .filter(({ path }) => path.startsWith('components/') && !path.startsWith('components/ui/'))
      .filter(({ path }) => !path.endsWith('shell/Skeleton.tsx'))
      .filter(({ source }) => skeletonsOutsideWaiting(source) > 0)
      .map(({ path }) => path)

    expect(silent).toEqual([])
  })

  it('would notice a bare one beside a proper one', () => {
    // Verbatim in the shape the plant took: a file that still holds a `WhileWaiting` and pulses somewhere else as well. The first version of this rule passed it, because it asked whether the file mentioned `WhileWaiting` rather than whether this skeleton was inside one.
    expect(
      skeletonsOutsideWaiting(
        '<div><Skeleton className="h-4" /></div><WhileWaiting what="x"><Skeleton /></WhileWaiting>'
      )
    ).toBe(1)

    expect(skeletonsOutsideWaiting('<WhileWaiting what="x"><Skeleton /><Skeleton /></WhileWaiting>')).toBe(0)
  })

  it('is asked of the screens that really wait on something', () => {
    expect(waiting.length).toBeGreaterThan(12)
    expect(waiting.map(({ path }) => path)).toContain('components/owed/WhatWeOwe.tsx')
  })
})
