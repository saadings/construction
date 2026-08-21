// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatThePartnersHave } from './Positions'
import { Positions } from './Positions'

afterEach(cleanup)

// One house: 60,000 and 20,000 put in, 120,000 come in from the client, 85,000 gone out. So 35,000 of profit, split three quarters and one.
const TWO_PARTNERS: WhatThePartnersHave = {
  positions: [
    {
      personId: 'p1',
      name: 'The partner',
      capitalPaisa: 6_000_000,
      basisPoints: 7_500,
      duePaisa: 2_625_000,
      paidPaisa: 2_000_000,
      balancePaisa: 625_000,
    },
    {
      personId: 'p2',
      name: 'Another partner',
      capitalPaisa: 2_000_000,
      basisPoints: 2_500,
      duePaisa: 875_000,
      paidPaisa: 0,
      balancePaisa: 875_000,
    },
  ],
  broughtInPaisa: 12_000_000,
  spentPaisa: 8_500_000,
  profitPaisa: 3_500_000,
  sold: true,
  sharesAgreed: false,
  ifItSoldToday: null,
}

// The same house before it is sold: nothing is due to anybody, and what a share would come to is an estimate underneath.
const STILL_BEING_BUILT: WhatThePartnersHave = {
  ...TWO_PARTNERS,
  sold: false,
  positions: TWO_PARTNERS.positions.map((position) => ({
    ...position,
    duePaisa: 0,
    balancePaisa: -position.paidPaisa,
  })),
  ifItSoldToday: {
    profitPaisa: 3_500_000,
    shares: [
      { personId: 'p1', name: 'The partner', paisa: 2_625_000 },
      { personId: 'p2', name: 'Another partner', paisa: 875_000 },
    ],
  },
}

describe('what each partner is owed', () => {
  it('gives each of them due, paid and what is left', async () => {
    render(<Positions what={TWO_PARTNERS} />)

    const rows = await screen.findAllByRole('listitem')
    // 26,250 due, 20,000 paid, 6,250 left -- comma grouped, the way the workbooks write it.
    expect(within(rows[0]).getByText('26,250')).toBeTruthy()
    expect(within(rows[0]).getByText('20,000')).toBeTruthy()
    expect(within(rows[0]).getByText('6,250')).toBeTruthy()
  })

  it('shows a partner who has drawn more than his share came to, rather than a dash', async () => {
    // Once the house is sold the figures are real, and one of them can be the wrong way round: he took 30,000 against a share that came to 26,250. The dash before the sale is about there being nothing to compare against, not about hiding a negative.
    render(
      <Positions
        what={{
          ...TWO_PARTNERS,
          positions: [{ ...TWO_PARTNERS.positions[0], paidPaisa: 3_000_000, balancePaisa: -375_000 }],
        }}
      />
    )

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('-3,750')).toBeTruthy()
  })

  it('says what each of them put in, and the share it comes to', async () => {
    render(<Positions what={TWO_PARTNERS} />)

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('60,000')).toBeTruthy()
    // Read back as the percentage somebody would say out loud, not as basis points.
    expect(within(rows[0]).getByText('75%')).toBeTruthy()
    expect(within(rows[1]).getByText('25%')).toBeTruthy()
  })

  it('reads a share with a fraction in it the way it was agreed', () => {
    render(
      <Positions
        what={{
          ...TWO_PARTNERS,
          sharesAgreed: true,
          positions: [{ ...TWO_PARTNERS.positions[0], basisPoints: 3_333 }],
        }}
      />
    )

    expect(screen.getByText('33.33%')).toBeTruthy()
  })

  it('says whether the shares were agreed or worked out from the money', () => {
    // The difference between a figure somebody chose and one nobody has looked at.
    render(<Positions what={TWO_PARTNERS} />)
    expect(screen.getByText('Shares follow what each of them put in.')).toBeTruthy()

    cleanup()
    render(<Positions what={{ ...TWO_PARTNERS, sharesAgreed: true }} />)
    expect(screen.getByText('Shares agreed between them.')).toBeTruthy()
  })

  it('shows what the house has made, from the two figures it is made of', () => {
    render(<Positions what={TWO_PARTNERS} />)

    expect(screen.getByText('120,000')).toBeTruthy()
    expect(screen.getByText('85,000')).toBeTruthy()
    expect(screen.getByText('35,000')).toBeTruthy()
  })

  it('says a house is out of pocket rather than showing a profit with a minus', () => {
    // Half way through a build everything is out and nothing is in, which is ordinary and should read as ordinary.
    render(<Positions what={{ ...TWO_PARTNERS, broughtInPaisa: 0, profitPaisa: -8_500_000 }} />)

    expect(screen.getByText('Out of pocket by')).toBeTruthy()
    expect(screen.queryByText('-85,000')).toBeNull()
    expect(screen.getAllByText('85,000').length).toBeGreaterThan(0)
  })

  it('says nobody has put anything in yet, rather than showing an empty table', async () => {
    render(<Positions what={{ ...TWO_PARTNERS, positions: [] }} />)

    expect(await screen.findByText(/Nobody has put money into this house yet/)).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('puts up the shape of what is coming while the answer is on its way', () => {
    render(<Positions what={undefined} />)

    // Said once when it appears, because a pulsing grey bar is nothing to a screen reader.
    expect(screen.getByRole('status', { name: 'Working out what each partner is owed' })).toBeTruthy()
    expect(screen.queryByText('Looking…')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('says nothing at all for a house that is not there, rather than watching for it', () => {
    // The two unknowns are different: one is a read in flight, the other is an answer. Flattening them is the permanent spinner.
    render(<Positions what={null} />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Looking…')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('names every figure on a phone, where there is no column heading above it', async () => {
    // The same markup at both widths means the headings are hidden on a phone, so each figure carries its own label.
    render(<Positions what={TWO_PARTNERS} />)

    const rows = await screen.findAllByRole('listitem')
    for (const label of ['Put in', 'Share', 'Due', 'Paid', 'Remaining']) {
      expect(within(rows[0]).getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('says nothing technical anywhere on it', async () => {
    render(<Positions what={TWO_PARTNERS} />)
    await screen.findAllByRole('listitem')

    expect(document.body.textContent).not.toMatch(/basis|paisa|record|entity|query|database|null|undefined/i)
  })
})

describe('a house that has not been sold', () => {
  it('shows nothing due and nothing left, rather than figures somebody could read as worked out', async () => {
    render(<Positions what={STILL_BEING_BUILT} />)

    const rows = await screen.findAllByRole('listitem')

    // Two dashes and not one. `Remaining` is due minus paid, so on a house that has not sold it is the negative of whatever he has drawn -- a figure under a heading that reads as the partnership owing him, when he is the one who has had money early.
    expect(within(rows[0]).getAllByText('—').length).toBe(2)

    // Said the other way round as well, because the count above would still be two if the dash landed in the wrong column and the figure moved.
    expect(within(rows[0]).queryByText(/^-/)).toBeNull()
    expect(within(rows[0]).queryByText('-20,000')).toBeNull()
  })

  it('still shows what has gone back to him, which is the one figure on that row that is real', async () => {
    // The control for the dashes above: a screen that answered `—` to everything would pass that test and tell him nothing.
    render(<Positions what={STILL_BEING_BUILT} />)

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('20,000')).toBeTruthy()
    expect(within(rows[0]).getByText('60,000')).toBeTruthy()
  })

  it('says out loud that what has gone out went ahead of the sale', () => {
    // Two dashes and a figure is not an explanation. Without this the row reads as a partner who has been paid something against nothing, and the reason is only in the head of whoever wrote the query.
    render(<Positions what={STILL_BEING_BUILT} />)

    expect(screen.getByText(/gone back to them ahead of it/)).toBeTruthy()
  })

  it('says nothing of the kind where nobody has been paid anything', () => {
    // The other end of it: a sentence that appears whether or not it is true is a sentence nobody reads.
    render(
      <Positions
        what={{
          ...STILL_BEING_BUILT,
          positions: STILL_BEING_BUILT.positions.map((position) => ({ ...position, paidPaisa: 0, balancePaisa: 0 })),
        }}
      />
    )

    expect(screen.queryByText(/gone back to them ahead of it/)).toBeNull()
  })

  it('says what a share would come to, and says it is an estimate', () => {
    render(<Positions what={STILL_BEING_BUILT} />)

    expect(screen.getByText('If this sold today')).toBeTruthy()
    expect(screen.getByText(/an estimate, not owed to anybody yet/)).toBeTruthy()
    expect(screen.getByText('26,250')).toBeTruthy()
  })

  it('keeps the estimate out of the table, where what is owed lives', async () => {
    // The seam. One column cannot be read for the other if they are not in the same column.
    render(<Positions what={STILL_BEING_BUILT} />)

    const rows = await screen.findAllByRole('listitem')
    // The rows of the table are the first two; the estimate's own rows come after them.
    expect(within(rows[0]).queryByText('26,250')).toBeNull()
    expect(within(rows[1]).queryByText('8,750')).toBeNull()
  })

  it('says nothing about an estimate once the house is sold', () => {
    render(<Positions what={TWO_PARTNERS} />)

    expect(screen.queryByText('If this sold today')).toBeNull()
    expect(screen.queryByText(/an estimate/)).toBeNull()
  })

  it('names the three totals over the table, which nothing had ever asked', () => {
    render(<Positions what={TWO_PARTNERS} />)

    // The tile said `Invested` and no test named it, so the rename to `Put in` was a change nothing was holding. These are `dt`s in a `dl`, so the reading is the pairing rather than the order they happen to be drawn in.
    expect(screen.getAllByRole('term').map((label) => label.textContent)).toEqual(['Put in', 'Expenses', 'Profit'])
  })
})
