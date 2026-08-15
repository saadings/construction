// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatPaisa } from '~shared/money'
import { contractValuePaisa } from '~shared/validation/contract'
import { billTotalPaisa, lineAmountPaisa } from '~shared/validation/extraWork'
import { milestoneAmountPaisa } from '~shared/validation/milestone'

import { DaySheet } from './components/daySheet/DaySheet'
import type { Draft } from './components/daySheet/sitting'
import { sittingTotalPaisa } from './components/daySheet/sitting'
import { WhatHasComeIn } from './components/moneyIn/WhatHasComeIn'
import { Positions } from './components/partners/Positions'
import { TheirAccount } from './components/people/TheirAccount'
import { AgreeAContract } from './components/site/AgreeAContract'
import { ExtraWork } from './components/site/ExtraWork'
import { SpentByTrade } from './components/site/SpentByTrade'
import { Stages } from './components/site/Stages'
import { HouseDetails } from './components/sites/HouseDetails'
import { pick } from './testing/pick'

afterEach(cleanup)

// Every test we have asks one module about its own rows. The failures found all afternoon were between things rather than inside them, so this drives one house the way somebody would and then reads the screens back.

// What it can prove and what it cannot, said plainly: the figures here are the ones the writing screens sent, so this holds the reading screens to the money that was actually typed in. It does not exercise the Convex queries -- those have their own tests, and re-deriving their arithmetic here would be asserting against a second copy of it.

// Invented throughout. Nobody real, no real address, and the only figures are ones chosen to be distinguishable from each other.
const PEOPLE = [
  { _id: 'p1', name: 'The partner' },
  { _id: 'p2', name: 'A steel supplier' },
  { _id: 'p3', name: 'The one it is built for' },
]

// One distinctive figure per idea, so a figure appearing on the wrong screen is unmistakable rather than a coincidence of round numbers. Held to it below, because the first version of this file failed exactly there: what a partner put in and what he was due came to the same figure by arithmetic, and a plant that wrote one of them wrongly still found the other on the screen.
const THE_HOUSE = '1-A, Phase 0'
const CONTRACT_RUPEES = '12,500,000'
const FIRST_STAGE_PERCENT = '20'
const PAID_TO_THE_SUPPLIER = 500_000_00
const PARTNER_PUT_IN = 1_200_000_00
const CLIENT_PAID = 2_500_000_00
const EXTRA_QUANTITY = '40'
const EXTRA_RATE = '2,500'

// `SpentByTrade` opens the payments behind a figure, which this walkthrough does not drive: it is handed the reading it needs and nothing opened.
function spentOn(paisa: number) {
  return (
    <SpentByTrade
      byTrade={[{ tradeId: 't1', name: 'Steel', paisa }]}
      onOpen={vi.fn()}
      opened={null}
      onTakeOut={vi.fn()}
      takingOut={null}
      refusal={null}
    />
  )
}

function withRoutes(children: ReactNode, at = '/') {
  const root = createRootRoute({ component: () => <>{children}</> })
  const kids = ['/sites/$siteId/coming-in', '/sites/$siteId/day', '/people/$personId'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null })
  )
  const router = createRouter({
    routeTree: root.addChildren(kids),
    history: createMemoryHistory({ initialEntries: [at] }),
  })

  render(<RouterProvider router={router} />)
}

/** The row a name sits on, so a figure is found where it belongs rather than anywhere on the screen. */
function theRowFor(name: string): HTMLElement {
  const rows = screen.queryAllByRole('row').filter((row) => row.textContent.includes(name))
  const listed = screen.queryAllByRole('listitem').filter((row) => row.textContent.includes(name))
  const found = [...rows, ...listed]

  // Said here rather than left to fail on a missing element three lines later, so a renamed row names itself.
  if (found.length === 0) {
    throw new Error(`No row on this screen says ${name}, so the figure on it cannot be checked.`)
  }

  return found[0]
}

/** Every money figure on the screen as it is written, which is what somebody reading it actually compares. */
function figuresOnScreen(): Array<string> {
  return screen.getAllByText(/^-?[\d,]+$/).map((said) => said.textContent)
}

describe('one house, driven the way he would drive it', () => {
  it('starts a house with the name it will be known by', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<HouseDetails saying="Start it" onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: THE_HOUSE } })
    fireEvent.change(screen.getByLabelText('Covered area'), { target: { value: '4975' } })
    fireEvent.click(screen.getByRole('radio', { name: 'For a client' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start it' }))

    await waitFor(() => {
      // Grouped as it is typed. It used to stay bare here and come back grouped the moment somebody opened the house to correct it, which is the first thing this walkthrough found.
      expect(onSave).toHaveBeenCalledWith({
        name: THE_HOUSE,
        coveredAreaSqft: '4,975',
        stage: 'building',
        builtForAClient: true,
      })
    })
  })

  it('agrees a contract, and the stage set out against it is a part of that figure', async () => {
    // The first seam: the contract screen sends a price, and the stages screen shows a figure worked out from it. Two screens, one number underneath.
    const onAgree = vi.fn().mockResolvedValue(undefined)
    render(<AgreeAContract people={PEOPLE} onAgree={onAgree} />)

    fireEvent.change(screen.getByLabelText('Who it is for'), { target: { value: 'p3' } })
    fireEvent.change(screen.getByLabelText('The whole price'), { target: { value: CONTRACT_RUPEES } })
    fireEvent.change(screen.getByLabelText('Area agreed'), { target: { value: '4975' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree it' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalled()
    })

    const agreed = onAgree.mock.calls[0][0] as { priced: { how: 'lumpSum'; totalPaisa: string } }
    // Read through the same rule the server reads it through, rather than through a second copy of it written here.
    const valuePaisa = contractValuePaisa({
      priced: { how: 'lumpSum', totalPaisa: 12_500_000_00 },
      agreedAreaSqft: 4975,
    })
    expect(agreed.priced.totalPaisa).toBe(CONTRACT_RUPEES)

    cleanup()
    const stagePaisa = milestoneAmountPaisa(valuePaisa, Number(FIRST_STAGE_PERCENT))
    render(
      <Stages
        stages={[{ _id: 'm1', description: 'On signing', percent: 20, amountPaisa: stagePaisa }]}
        percentAgreed={20}
        onAdd={vi.fn()}
        onBill={vi.fn()}
      />
    )

    // A fifth of 12,500,000 is 2,500,000, and that is the figure the client is asked for.
    expect(screen.getByText(formatPaisa(stagePaisa))).toBeTruthy()
    expect(stagePaisa).toBe(CLIENT_PAID)
  })

  it('bills for extra work, and the bill is its lines and nothing else', async () => {
    const onRaise = vi.fn().mockResolvedValue(undefined)
    render(<ExtraWork bills={[]} onRaise={onRaise} onTakeBack={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('What the work was'), { target: { value: 'Extra retaining wall' } })
    fireEvent.change(screen.getByLabelText('What it was on line 1'), { target: { value: 'Brickwork' } })
    fireEvent.change(screen.getByLabelText('How much of it on line 1'), { target: { value: EXTRA_QUANTITY } })
    fireEvent.change(screen.getByLabelText('Measured in on line 1'), { target: { value: 'cft' } })
    fireEvent.change(screen.getByLabelText('Rate on line 1'), { target: { value: EXTRA_RATE } })
    fireEvent.click(screen.getByRole('button', { name: 'Raise the bill' }))

    await waitFor(() => {
      expect(onRaise).toHaveBeenCalled()
    })

    // 40 cft at 2,500 is 100,000, worked out by the rule both sides share.
    const linePaisa = lineAmountPaisa({ quantity: 40, ratePaisa: 250_000 })
    expect(linePaisa).toBe(100_000_00)

    cleanup()
    render(
      <ExtraWork
        bills={[
          {
            _id: 'b1',
            raisedOn: '2026-05-01',
            description: 'Extra retaining wall',
            totalPaisa: billTotalPaisa([{ quantity: 40, ratePaisa: 250_000 }]),
            lines: [{ _id: 'l1', description: 'Brickwork', quantity: 40, unit: 'cft', amountPaisa: linePaisa }],
          },
        ]}
        onRaise={vi.fn()}
        onTakeBack={vi.fn()}
      />
    )

    // The bill and its only line are the same money, so they must read as the same figure.
    const raised = within(screen.getByRole('list', { name: 'Bills already raised' })).getByRole('listitem')
    expect(within(raised).getAllByText(formatPaisa(linePaisa))).toHaveLength(2)
  })
})

describe('the same money, read off two screens', () => {
  // What came in on the house: a partner funding it, and the client paying the first stage.
  const comeIn = {
    byWhy: { partnerMoney: PARTNER_PUT_IN, clientPayment: CLIENT_PAID, sale: 0 },
    receivedPaisa: PARTNER_PUT_IN + CLIENT_PAID,
  }

  // What the partners have, which is the other screen those same receipts reach.
  const partners = {
    positions: [
      {
        personId: 'p1',
        name: 'The partner',
        capitalPaisa: PARTNER_PUT_IN,
        basisPoints: 10_000,
        duePaisa: CLIENT_PAID - PAID_TO_THE_SUPPLIER,
        paidPaisa: 0,
        balancePaisa: CLIENT_PAID - PAID_TO_THE_SUPPLIER,
      },
    ],
    broughtInPaisa: CLIENT_PAID,
    spentPaisa: PAID_TO_THE_SUPPLIER,
    profitPaisa: CLIENT_PAID - PAID_TO_THE_SUPPLIER,
    sold: false,
    sharesAgreed: false,
    ifItSoldToday: null,
  }

  it('gives every idea in this walkthrough a figure of its own', () => {
    // The control on the fixture rather than on the app. Two ideas sharing a figure is how an assertion passes by finding the wrong one: the first version had what a partner put in and what he was due coming to the same number.
    const figures = [PAID_TO_THE_SUPPLIER, PARTNER_PUT_IN, CLIENT_PAID, partners.profitPaisa, comeIn.receivedPaisa]

    expect(new Set(figures).size).toBe(figures.length)
  })

  it('shows what a partner put in as the same figure on both of them', async () => {
    withRoutes(<WhatHasComeIn siteId="s1" totals={comeIn} />)
    await screen.findByText('Come in')

    const onTheHouse = within(theRowFor('Partners put in')).getByText(formatPaisa(PARTNER_PUT_IN))
    expect(onTheHouse).toBeTruthy()

    cleanup()
    render(<Positions what={partners} />)

    // Found on his own row rather than anywhere on the screen: a figure that happens to match another one elsewhere is not this figure.
    expect(within(theRowFor('The partner')).getByText(formatPaisa(PARTNER_PUT_IN))).toBeTruthy()
  })

  it('keeps a partner’s own money out of what the house brought in', async () => {
    // The distinction the whole profit split stands on, checked where it is most likely to be lost: between the screen that says what came in and the screen that says what the partners have.
    withRoutes(<WhatHasComeIn siteId="s1" totals={comeIn} />)
    await screen.findByText('Come in')

    // Come in altogether is both. Brought in is only the client's.
    expect(figuresOnScreen()).toContain(formatPaisa(PARTNER_PUT_IN + CLIENT_PAID))

    cleanup()
    render(<Positions what={partners} />)

    // 4,500,000 is what arrived. It must not appear beside the profit, because counting capital as income makes a house look profitable the moment somebody funds it.
    expect(figuresOnScreen()).not.toContain(formatPaisa(PARTNER_PUT_IN + CLIENT_PAID))
    expect(figuresOnScreen()).toContain(formatPaisa(CLIENT_PAID))
  })

  it('spends the figure the day sheet actually sent, not one written down here', async () => {
    // The figure comes out of the writing screen rather than out of a constant in this file. Handing both reading screens the same number I chose would only prove they can each print a number.
    const user = userEvent.setup()
    const onPutIn = vi.fn<(drafts: Array<Draft>) => Promise<boolean>>(() => Promise.resolve(true))

    render(
      <DaySheet
        siteName={THE_HOUSE}
        day="2026-04-02"
        onChangeDay={vi.fn()}
        trades={[{ _id: 't1', name: 'Steel' }] as unknown as Parameters<typeof DaySheet>[0]['trades']}
        people={PEOPLE as unknown as Parameters<typeof DaySheet>[0]['people']}
        accounts={[{ _id: 'b1', label: 'Bank 0000' }] as unknown as Parameters<typeof DaySheet>[0]['accounts']}
        saving={false}
        refusal={null}
        onPutIn={onPutIn}
        onAddAccount={vi.fn()}
      />
    )

    await pick(user, 'What for', 'Steel')
    // One control now, opened and chosen from. Answering "who" used to mean first deciding which of two boxes you meant.
    await pick(user, 'Who was paid', 'A steel supplier')
    await user.type(screen.getByLabelText('How much'), '500000')
    // A row of choices since it stopped being a picker, which is the fix that came out of the label defect.
    await user.click(screen.getByRole('radio', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: 'Put them in' }))

    await waitFor(() => {
      expect(onPutIn).toHaveBeenCalled()
    })

    // Read back through the rule both sides share, so this is the paisa the server is being sent.
    const [sent] = onPutIn.mock.calls[0]
    const wentOut = sittingTotalPaisa(sent)
    expect(wentOut).toBe(PAID_TO_THE_SUPPLIER)

    cleanup()
    render(spentOn(wentOut))
    const onTheTrade = figuresOnScreen()

    cleanup()
    render(<Positions what={{ ...partners, spentPaisa: wentOut }} />)

    // What went out on the trade, and what the partners are told went out, are one payment.
    expect(onTheTrade).toContain(formatPaisa(wentOut))
    expect(figuresOnScreen()).toContain(formatPaisa(wentOut))
  })

  it('shows the supplier the same payment his own account shows', () => {
    render(
      <TheirAccount
        answer={{
          account: {
            name: 'A steel supplier',
            lines: [
              {
                what: 'paid',
                day: '2026-04-02',
                amountPaisa: PAID_TO_THE_SUPPLIER,
                id: 'y1',
                balancePaisa: -PAID_TO_THE_SUPPLIER,
                onWhichHouse: THE_HOUSE,
              },
            ],
            billedPaisa: 0,
            paidPaisa: PAID_TO_THE_SUPPLIER,
          },
        }}
      />
    )
    const onHisAccount = figuresOnScreen()

    cleanup()
    render(spentOn(PAID_TO_THE_SUPPLIER))

    // The one payment, on the house's trade and on the man's account. A ledger where these differ is one nobody can settle a disagreement with.
    expect(onHisAccount).toContain(formatPaisa(PAID_TO_THE_SUPPLIER))
    expect(figuresOnScreen()).toContain(formatPaisa(PAID_TO_THE_SUPPLIER))
  })

  it('writes every figure the same way, on every screen that shows one', async () => {
    // Not a formality: a figure grouped on one screen and bare on another is two figures to somebody reading them a minute apart. A plant that wrote one of them bare got past the first version of this, because the assertion only ever looked at one screen.
    withRoutes(<WhatHasComeIn siteId="s1" totals={comeIn} />)
    await screen.findByText('Come in')
    const everywhere = [...figuresOnScreen()]

    cleanup()
    render(<Positions what={partners} />)
    everywhere.push(...figuresOnScreen())

    cleanup()
    render(spentOn(PAID_TO_THE_SUPPLIER))
    everywhere.push(...figuresOnScreen())

    expect(everywhere.length).toBeGreaterThan(8)
    for (const said of everywhere) {
      // 1,200,000 rather than 1200000, everywhere, because that is how the figure is written on paper.
      expect(said).toMatch(/^-?\d{1,3}(,\d{3})*$/)
    }
  })
})
