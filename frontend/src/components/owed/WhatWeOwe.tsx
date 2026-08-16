import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { formatPaisa } from '~shared/money'

import { NotKnownHere } from '../shell/NotKnownHere'
import { Figure, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type OnAHouse = {
  siteId: string
  name: string
  billedPaisa: number
  paidPaisa: number
  outstandingPaisa: number
}

export type Standing = {
  personId: string
  name: string
  billedPaisa: number
  paidPaisa: number
  outstandingPaisa: number
  onHouses: Array<OnAHouse>
}

export type WhatIsOwed = {
  everyone: Array<Standing>
  payablePaisa: number
  advancedPaisa: number
}

// The `MARKET PAYABLES` sheet: what is owed altogether and to whom, in one look rather than one man at a time.

// Across every house on purpose. A steel supplier delivering to two of them is owed one figure, and two half-balances on two houses is the 487-R mistake in a new place -- nobody adds them up and the pair disagree by the time anybody tries.

// One grid for the whole list, and every row takes its columns from it. Written per row, the phone's `auto` track sized to whatever was in that row: three people put `Standing` at 346 and one put it at 355, because the figures beside it were a different width. The tracks are declared once and the widest content in the column decides them for everybody.
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]'

/** A row, or anything between the grid and a row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

export function WhatWeOwe({ owed }: { owed: WhatIsOwed | null | undefined }) {
  if (owed === undefined) {
    return (
      <Page title="Owed">
        <OwedWaiting />
      </Page>
    )
  }

  // The ledger has answered and does not know this sign-in. Nothing on this screen would work, so it offers none of it.
  if (owed === null) {
    return (
      <Page title="Owed">
        <NotKnownHere />
      </Page>
    )
  }

  return (
    <Page title="Owed">
      <BothWays payablePaisa={owed.payablePaisa} advancedPaisa={owed.advancedPaisa} />

      {owed.everyone.length === 0 ? (
        <p className="text-muted-foreground max-w-prose py-6">
          Nothing is owed to anybody yet. What somebody bills lands here, and what has been paid to them comes off it.
        </p>
      ) : (
        <div className={GRID}>
          <div
            className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
          >
            <span>Who</span>
            <span className="text-right">Billed</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Standing</span>
          </div>

          <ul className={`${ROW} divide-hairline gap-y-0 divide-y`}>
            {owed.everyone.map((person) => (
              <OnePerson key={person.personId} person={person} />
            ))}
          </ul>
        </div>
      )}
    </Page>
  )
}

// Two figures and never one. An advance held by the tile man is not money available to pay the steel man, so netting them makes a figure that looks actionable and is not -- which is exactly why the workbooks keep MARKET PAYABLES and TOTAL RECEIVABLE on separate lines.
function BothWays({ payablePaisa, advancedPaisa }: { payablePaisa: number; advancedPaisa: number }) {
  return (
    <section className="flex flex-wrap items-baseline gap-x-12 gap-y-4">
      <div>
        <p className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">Owed to them</p>
        {/* Green, because it is money owed out of the partnership rather than money already gone. */}
        <Figure className="text-green text-[2.5rem] leading-none">{formatPaisa(payablePaisa)}</Figure>
      </div>

      <div>
        <p className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">Held in advance</p>
        <Figure className="text-foreground text-xl">{formatPaisa(advancedPaisa)}</Figure>
      </div>
    </section>
  )
}

function OnePerson({ person }: { person: Standing }) {
  // The one balance is the debt; the houses under it are how it is explained to the man asking. Closed until somebody asks, because most of the time the figure is the whole answer.
  const [open, setOpen] = useState(false)
  const holding = person.outstandingPaisa < 0

  return (
    <li className={`${ROW} py-3.5`}>
      <span className="flex min-w-0 items-baseline gap-2">
        <Link
          to="/people/$personId"
          params={{ personId: person.personId }}
          className="text-foreground min-w-0 truncate text-[1.0625rem] underline-offset-4 hover:underline"
        >
          {person.name}
        </Link>

        {person.onHouses.length < 2 ? null : (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`Which houses ${person.name} is owed on`}
            className="text-muted-foreground shrink-0 text-sm"
          >
            {person.onHouses.length} houses
          </button>
        )}
      </span>

      <Cell label="Billed">{formatPaisa(person.billedPaisa)}</Cell>
      {/* Brass, because it is money that has gone out. */}
      <Cell label="Paid" tone="text-brass">
        {formatPaisa(person.paidPaisa)}
      </Cell>
      <Cell label="Standing" tone={holding ? 'text-foreground' : 'text-green'}>
        {holding ? `${formatPaisa(-person.outstandingPaisa)} adv` : formatPaisa(person.outstandingPaisa)}
      </Cell>

      {open ? (
        <ul className="text-muted-foreground col-span-full flex flex-col gap-1 pt-2 pl-4 text-sm">
          {person.onHouses.map((house) => (
            <li key={house.siteId} className="flex items-baseline justify-between gap-4">
              <Link
                to="/sites/$siteId"
                params={{ siteId: house.siteId }}
                className="min-w-0 truncate underline-offset-4 hover:underline"
              >
                {house.name}
              </Link>
              <Figure className="shrink-0">
                {house.outstandingPaisa < 0
                  ? `${formatPaisa(-house.outstandingPaisa)} adv`
                  : formatPaisa(house.outstandingPaisa)}
              </Figure>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function Cell({ label, tone, children }: { label: string; tone?: string; children: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 sm:justify-end">
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase sm:hidden">{label}</span>
      <Figure className={`${tone ?? 'text-foreground'} text-right`}>{children}</Figure>
    </span>
  )
}

// The shape of what is coming: the two figures, then the list under them.
function OwedWaiting() {
  return (
    <WhileWaiting what="Working out what is owed">
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-56 max-w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>

      <div className="divide-hairline flex flex-col divide-y">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-baseline justify-between gap-4 py-3.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
