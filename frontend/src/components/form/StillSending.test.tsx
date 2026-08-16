// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { StillSending } from './StillSending'

// A send that never comes back. Convex queues a mutation while the connection is down and re-sends it when the connection returns, so the promise never settles -- and this app answered that with a button that turns itself off and a ring that turns, saying nothing, for as long as he stands there.

// He enters payments standing on a building site. This is not an edge case there.

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** The sentence, whatever it says. Matched on the part that cannot change without the promise changing: that it has not gone in. */
const SAYS_SO = /has not gone in yet/

describe('a send that has not come back', () => {
  it('says nothing while a send is ordinary', () => {
    vi.useFakeTimers()
    render(<StillSending busy />)

    // Four seconds in, this is a save on a slow connection and there is nothing to say about it. A sentence here would teach him to ignore the one that matters.
    act(() => {
      vi.advanceTimersByTime(4_000)
    })

    expect(screen.queryByText(SAYS_SO)).toBeNull()
  })

  it('says so once it has been long enough to be worth saying', () => {
    vi.useFakeTimers()
    render(<StillSending busy />)

    act(() => {
      vi.advanceTimersByTime(9_000)
    })

    expect(screen.getByText(SAYS_SO)).toBeTruthy()
  })

  it('asks him to keep the screen open, because that is the one thing that would lose it', () => {
    // What it may promise, read out of the client rather than assumed: `request_manager.restart()` re-sends every inflight mutation, so "it will go in" is true -- and the queue is in memory, so closing the app is what loses it. A wrong reassurance about his money is worse than a spinner.
    vi.useFakeTimers()
    render(<StillSending busy />)
    act(() => {
      vi.advanceTimersByTime(9_000)
    })

    const said = screen.getByText(SAYS_SO).textContent

    expect(said).toContain('as soon as the phone has signal')
    expect(said).toContain('Keep this screen open')
    // And never that it failed, because it has not.
    expect(said).not.toMatch(/failed|error|wrong|try again/i)
  })

  it('says what is true of the screen it is on, and not what used to be true of all of them', () => {
    // `Keep this screen open` was true everywhere when it was written. The day sheet keeps its sitting on the device now, so there it understates what the app does and asks him for something a phone does not let him promise -- while it is still the whole truth on every screen that keeps nothing.
    vi.useFakeTimers()
    const { rerender } = render(<StillSending busy />)
    act(() => {
      vi.advanceTimersByTime(9_000)
    })

    expect(screen.getByText(SAYS_SO).textContent).toContain('Keep this screen open')

    rerender(<StillSending busy keeps />)

    const said = screen.getByText(SAYS_SO).textContent

    expect(said).toContain('What you have typed is kept')
    expect(said).not.toContain('Keep this screen open')
  })

  it('takes it back the moment the send comes back', () => {
    vi.useFakeTimers()
    const { rerender } = render(<StillSending busy />)
    act(() => {
      vi.advanceTimersByTime(9_000)
    })
    expect(screen.getByText(SAYS_SO)).toBeTruthy()

    rerender(<StillSending busy={false} />)

    expect(screen.queryByText(SAYS_SO)).toBeNull()
  })

  it('says nothing at all when nothing is being sent', () => {
    vi.useFakeTimers()
    render(<StillSending busy={false} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.queryByText(SAYS_SO)).toBeNull()
  })
})

describe('every screen that sends something', () => {
  // Seventeen files draw a button that can be sending. A rule re-applied by hand at seventeen call sites is a rule the eighteenth forgets, and the eighteenth is written by somebody who never saw a spinner with no end.
  const sending = everyScreen().filter(
    ({ path, source }) =>
      path.startsWith('components/') &&
      /busy=\{/.test(source) &&
      // The two controls that only pass a send through. `Button` is the ring itself and `WayOut` is a button somebody else decides is sending -- the screen holding them is where the sentence belongs, and this sweep is about screens.
      !path.endsWith('/Button.tsx') &&
      !path.endsWith('/WayOut.tsx')
  )

  it('says so when the send has not come back', () => {
    const silent = sending.filter(({ source }) => !source.includes('<StillSending')).map(({ path }) => path)

    expect(silent).toEqual([])
  })

  it('is asked of the screens that really send something', () => {
    // The floor. A sweep that stopped finding sending buttons reports the same clean nothing as an app where every one of them speaks.
    expect(sending.length).toBeGreaterThan(12)
    expect(sending.map(({ path }) => path)).toContain('components/daySheet/DaySheet.tsx')
  })
})
