// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NotFound } from './NotFound'

/**
 * The screen someone reaches by following an address that no longer opens
 * anything — a bookmark to a removed site, a link pasted out of a message a
 * year old.
 *
 * Two things are asserted, and neither is about how it looks. It has to say
 * what to do next, because a dead end is the one thing a lost person cannot
 * work around. And it has to say it in the words the business uses: this
 * screen previously led with `404`, which names a fault in the machinery to
 * someone who only wanted their sites back.
 */

/** The words the design rules keep off every screen, including this one. */
const MACHINERY = new RegExp(
  `\\b(${[
    'record',
    'entry',
    'entity',
    'ledger',
    'sync',
    'category',
    'vendor',
    'field',
    'validation',
    'required',
    'error',
    'database',
    'query',
  ].join('|')})\\b`,
  'i'
)

/** Anything shaped like the status code this screen used to lead with. */
const STATUS_CODE = /\b[1-5][0-9]{2}\b/

afterEach(cleanup)

describe('the screen for an address that opens nothing', () => {
  it('offers a way back rather than dead-ending', () => {
    render(<NotFound />)

    const wayBack = screen.getByRole('link')

    expect(wayBack).toHaveProperty('pathname', '/')
    expect(wayBack.textContent).toBe('Go back to the start')
  })

  it('says it in the words the business uses', () => {
    const { container } = render(<NotFound />)
    const shown = container.textContent

    // Guards against an empty read passing both checks below. A screen that
    // rendered nothing at all would contain no forbidden word either.
    expect(shown.length).toBeGreaterThan(20)

    expect(MACHINERY.test(shown)).toBe(false)
    expect(STATUS_CODE.test(shown)).toBe(false)
  })

  it('would catch wording that had slipped back into the machinery', () => {
    // The control. Both patterns have to fire on something, or the test above
    // passes on the strength of a regular expression that matches nothing.
    expect(STATUS_CODE.test('404 - Page Not Found')).toBe(true)
    expect(MACHINERY.test('That record could not be found.')).toBe(true)

    // And stays quiet on wording that already ships, so it is not noise.
    expect(MACHINERY.test('Sites, spending and what everyone is owed.')).toBe(false)
    expect(STATUS_CODE.test('Sites, spending and what everyone is owed.')).toBe(false)
  })
})
