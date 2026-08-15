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
  sharesAgreed: false,
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

  it('says it is still looking before the answer arrives', () => {
    render(<Positions what={null} />)

    expect(screen.getByText('Looking…')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('names every figure on a phone, where there is no column heading above it', async () => {
    // The same markup at both widths means the headings are hidden on a phone, so each figure carries its own label.
    render(<Positions what={TWO_PARTNERS} />)

    const rows = await screen.findAllByRole('listitem')
    for (const label of ['Put in', 'Share', 'Due', 'Paid', 'Left']) {
      expect(within(rows[0]).getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('says nothing technical anywhere on it', async () => {
    render(<Positions what={TWO_PARTNERS} />)
    await screen.findAllByRole('listitem')

    expect(document.body.textContent).not.toMatch(/basis|paisa|record|entity|query|database|null|undefined/i)
  })
})
