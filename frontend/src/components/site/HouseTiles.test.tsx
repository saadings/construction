// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatTheHouseComesTo } from './HouseTiles'
import { HouseTiles, shareOfTheEstimate } from './HouseTiles'

afterEach(cleanup)

// Every figure different, so a tile reading the wrong field cannot look like a working tile.
function aHouse(over: Partial<WhatTheHouseComesTo> = {}): WhatTheHouseComesTo {
  return {
    spentPaisa: 11_798_452_00,
    receivedPaisa: 14_250_000_00,
    budgetEstimatePaisa: 19_400_000_00,
    contractPaisa: 23_600_000_00,
    ...over,
  }
}

describe('what a house comes to', () => {
  it('carries the four figures the drawing puts across the top', () => {
    render(<HouseTiles what={aHouse()} />)

    expect(screen.getAllByRole('term').map((label) => label.textContent)).toEqual([
      'Spent so far',
      'Left in estimate',
      'Received',
      'Expected margin',
    ])

    const said = screen.getAllByRole('definition').map((figure) => figure.textContent)

    expect(said).toContain('11,798,452')
    // 19,400,000 less 11,798,452.
    expect(said).toContain('7,601,548')
    expect(said).toContain('14,250,000')
    // 23,600,000 less 19,400,000.
    expect(said).toContain('4,200,000')
  })

  it('says what each figure is measured against, rather than leaving four numbers in a row', () => {
    render(<HouseTiles what={aHouse()} />)

    const said = screen.getAllByRole('definition').map((figure) => figure.textContent)

    expect(said).toContain('Estimate 19,400,000')
    expect(said).toContain('61% of the estimate used')
    expect(said).toContain('Contract 23,600,000')
    expect(said).toContain('Contract less estimate')
  })

  it('says what is missing where a house has no estimate, on every tile that needs one', () => {
    render(<HouseTiles what={aHouse({ budgetEstimatePaisa: undefined })} />)

    const said = screen.getAllByRole('definition').map((figure) => figure.textContent)

    // The question applies to every house, so the tile stays and says it has not been answered.
    expect(said).toContain('No estimate set for this house.')
    expect(said).toContain('Put an estimate on this house to see this.')
    expect(said).toContain('Needs an estimate as well as the contract.')

    // And the figures that depend on it are a dash rather than a nought, which would read as a house with nothing left.
    expect(screen.getAllByRole('term').map((label) => label.textContent)).toContain('Left in estimate')
  })

  it('does not draw a margin on a house nobody is paying for, because the question does not arise', () => {
    render(<HouseTiles what={aHouse({ contractPaisa: null })} />)

    // Three tiles, not four with a gap in one. `Contract less estimate` is not a question about a house the partnership is building to sell -- nothing is missing, so nothing says it is.
    expect(screen.getAllByRole('term').map((label) => label.textContent)).toEqual([
      'Spent so far',
      'Left in estimate',
      'Received',
    ])

    expect(screen.getAllByRole('definition').map((one) => one.textContent)).toContain(
      'No contract: this house is the partnership’s own to sell.'
    )
  })

  it('says a house has gone past its estimate rather than showing what is left as a minus', () => {
    render(<HouseTiles what={aHouse({ spentPaisa: 21_000_000_00 })} />)

    const labels = screen.getAllByRole('term').map((label) => label.textContent)
    const said = screen.getAllByRole('definition').map((figure) => figure.textContent)

    // A minus in front of a figure is a thing somebody reads past, which is why this app says it in a word everywhere money can go the other way.
    expect(labels).toContain('Over the estimate by')
    expect(labels).not.toContain('Left in estimate')
    expect(said).toContain('1,600,000')
    expect(said.join(' ')).not.toContain('-1,600,000')
  })

  it('says a contract worth less than the estimate is an expected loss', () => {
    render(<HouseTiles what={aHouse({ contractPaisa: 15_000_000_00 })} />)

    expect(screen.getAllByRole('term').map((label) => label.textContent)).toContain('Expected loss')
    expect(screen.getAllByRole('definition').map((one) => one.textContent)).toContain('4,400,000')
  })
})

describe('how much of the estimate has gone', () => {
  it('is the share somebody would say out loud', () => {
    expect(shareOfTheEstimate(50, 100)).toBe(50)
    expect(shareOfTheEstimate(11_798_452, 19_400_000)).toBe(61)
  })

  it('answers for a house that has no estimate to be measured against, rather than dividing by it', () => {
    // `spent / 0` is `Infinity`, and a tile reading `Infinity% of the estimate used` is a screen nobody can act on.
    expect(shareOfTheEstimate(500, 0)).toBe(0)
    expect(shareOfTheEstimate(0, 0)).toBe(0)
  })

  it('is not capped, because past the estimate is the state that matters', () => {
    // The bar on the houses screen caps at a hundred so it cannot draw outside its own track. This is a figure rather than a length, and a figure capped at a hundred would report a house at two and a half times its estimate as one exactly on it.
    expect(shareOfTheEstimate(250, 100)).toBe(250)
  })
})
