// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NotFound } from './NotFound'

// Asserts what the dead end says, not how it looks: a way onward, in the words the business uses rather than `404`.

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

    // Guards the checks below against an empty read: a screen rendering nothing contains no forbidden word either.
    expect(shown.length).toBeGreaterThan(20)

    expect(MACHINERY.test(shown)).toBe(false)
    expect(STATUS_CODE.test(shown)).toBe(false)
  })

  it('would catch wording that had slipped back into the machinery', () => {
    // The control: both patterns must fire on something, or the test above passes on a regex that matches nothing.
    expect(STATUS_CODE.test('404 - Page Not Found')).toBe(true)
    expect(MACHINERY.test('That record could not be found.')).toBe(true)

    // And stays quiet on wording that already ships, so it is not noise.
    expect(MACHINERY.test('Sites, spending and what everyone is owed.')).toBe(false)
    expect(STATUS_CODE.test('Sites, spending and what everyone is owed.')).toBe(false)
  })
})
