import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { formatPaisa } from '~shared/money'

import { cn } from '../../lib/utils'
import { WayOut } from '../form/WayOut'
import { NotKnownHere } from '../shell/NotKnownHere'
import { Figure, Page } from '../shell/Page'
import { TablePanel, Tile } from '../shell/Panel'
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

// The drawing puts three tiles over this table and two of them are dropped rather than filled with a guess. **Past due** needs a day a bill falls due and a bill has none -- there are no terms anywhere in this app, so late is not a thing it can know. **Cash on hand** needs an opening balance per account, which nothing holds; adding up what has moved gives a figure that is confidently wrong for every account that did not start at nothing. The drawn **oldest unpaid bill** and its age go the same way: money goes out on account rather than against bill seven, so which bill is still unpaid is not answerable without a rule nobody has decided.

// One grid for the whole list, and every row takes its columns from it. Written per row, the phone's `auto` track sized to whatever was in that row: three people put `Outstanding` at 346 and one put it at 355, because the figures beside it were a different width. The tracks are declared once and the widest content in the column decides them for everybody.
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]'

// The day sheet's parameter, named once. It is a contract with a route this file does not own, and a mismatch would send somebody to the right screen with nobody chosen -- which is indistinguishable from a working button, including in a photograph.
export const PAYING = 'paying'

/** A row, or anything between the grid and a row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

export function WhatWeOwe({ owed }: { owed: WhatIsOwed | null | undefined }) {
  if (owed === undefined) {
    return (
      <Page title="Payables" said={WHAT_THIS_IS}>
        <OwedWaiting />
      </Page>
    )
  }

  // The ledger has answered and does not know this sign-in. Nothing on this screen would work, so it offers none of it.
  if (owed === null) {
    return (
      <Page title="Payables" said={WHAT_THIS_IS}>
        <NotKnownHere />
      </Page>
    )
  }

  return (
    <Page title="Payables" said={WHAT_THIS_IS}>
      <BothWays payablePaisa={owed.payablePaisa} advancedPaisa={owed.advancedPaisa} />

      {owed.everyone.length === 0 ? (
        <p className="text-muted-foreground max-w-prose py-6">
          Nothing is owed to anybody yet. What somebody bills lands here, and what has been paid to them comes off it.
        </p>
      ) : (
        <TablePanel>
          <div className={GRID}>
            <div
              className={`${ROW} text-muted-foreground border-border hidden border-b px-5 py-2.5 text-[0.75rem] font-semibold sm:grid`}
            >
              <span>Who</span>
              {/* The answer beside the name, the working after it, which is the order the drawing reads in: what he is owed today is the question, and billed and paid are how that figure was arrived at. */}
              <span className="text-right">Outstanding</span>
              <span className="text-right">Billed</span>
              <span className="text-right">Paid</span>
              <span className="text-right">Action</span>
            </div>

            <ul className={ROW}>
              {owed.everyone.map((person) => (
                <OnePerson key={person.personId} person={person} />
              ))}
            </ul>
          </div>
        </TablePanel>
      )}
    </Page>
  )
}

/** What the screen is, said where the drawing says it. */
const WHAT_THIS_IS =
  'What has been billed and not yet paid — one balance for each person, across every house they are on.'

// Two figures and never one. An advance held by the tile man is not money available to pay the steel man, so netting them makes a figure that looks actionable and is not -- which is exactly why the workbooks keep MARKET PAYABLES and TOTAL RECEIVABLE on separate lines.
function BothWays({ payablePaisa, advancedPaisa }: { payablePaisa: number; advancedPaisa: number }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Green, because it is money owed out of the partnership rather than money already gone. */}
      <Tile label="Owed to them" tone="text-green">
        <Figure>{formatPaisa(payablePaisa)}</Figure>
      </Tile>
      <Tile
        label="Paid in advance"
        beneath="Held by somebody who has had more than he has billed. Not money to pay anybody else with."
      >
        <Figure>{formatPaisa(advancedPaisa)}</Figure>
      </Tile>
    </dl>
  )
}

function OnePerson({ person }: { person: Standing }) {
  // The one balance is the debt; the houses under it are how it is explained to the man asking. Closed until somebody asks, because most of the time the figure is the whole answer.
  const [open, setOpen] = useState(false)
  const holding = person.outstandingPaisa < 0

  return (
    <li className={`${ROW} border-border hover:bg-row-hover border-b px-5 py-3.5 transition-colors last:border-0`}>
      {/* The control goes under the name on a phone rather than beside it. Sharing one track, `2 houses` is a fixed width and the name is what gives way -- `The steel supplier` came out 15px wide, a letter and a full stop, on the only row that can carry the control at all. Nothing had ever drawn one: every person in every fixture was owed on exactly one house. */}

      {/* The row gap has to clear a negative margin rather than look right. `ROOM_FOR_A_THUMB` is `py-3 -my-3`, so the control keeps a 44px target without stretching the row it sits in -- and stacked under the name that pulls its box 12px up, over the name's, by 8px at `gap-y-1`. Invisible on screen and a real tap landing on the wrong one of two things. */}
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-4">
        <Link
          to="/people/$personId"
          params={{ personId: person.personId }}
          className="text-foreground min-w-0 basis-full truncate text-[1.0625rem] underline-offset-4 hover:underline sm:basis-auto"
        >
          {person.name}
        </Link>

        {person.onHouses.length < 2 ? null : (
          <WayOut
            className="shrink-0"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`Which houses ${person.name} is owed on`}
          >
            {person.onHouses.length} houses
          </WayOut>
        )}
      </span>

      <Cell label="Outstanding" tone={holding ? 'text-foreground' : 'text-green'}>
        {holding ? `${formatPaisa(-person.outstandingPaisa)} adv` : formatPaisa(person.outstandingPaisa)}
      </Cell>
      {/* A line each on a phone rather than two in a two-column row. Sharing those tracks, `883,701` ran straight into the `PAID` beside it with nothing between them -- and before the figures were told not to break, the same squeeze drew `BILLED` as `BILLE` over `D`. Fewer columns, not narrower ones. */}
      <Cell label="Billed" className="col-span-full sm:col-span-1">
        {formatPaisa(person.billedPaisa)}
      </Cell>
      {/* Brass, because it is money that has gone out. */}
      <Cell label="Paid" tone="text-brass" className="col-span-full sm:col-span-1">
        {formatPaisa(person.paidPaisa)}
      </Cell>

      {/* A payment belongs to a house, because `payments.record` is a site mutation. So the house is never guessed: a man owed on one house gets the way to pay him here, and a man owed on several gets one against each house, under the list that already names them. */}
      <span className="col-span-full flex justify-end sm:col-span-1">
        {owingOn(person).length === 1 ? <Pay person={person} house={owingOn(person)[0]} /> : null}
      </span>

      {open ? (
        <ul className="text-muted-foreground col-span-full flex flex-col gap-1 pt-2 pl-4 text-sm">
          {person.onHouses.map((house) => (
            {/* Wrapping, because `Pay` joined this line and a 44px control beside a name on a phone does not fit beside it. The row gap is not the 4 above: what has to be cleared is the house-name link, which is a link in a line and wants 24px kept around it rather than merely not being sat on. Overlap and clearance are two checks and passing the first says nothing about the second. */}
            <li key={house.siteId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-6">
              {/* 24px rather than a bare 20px line, reached with padding and left inline. `inline-flex` was tried first and moved these out of the rule for a link in a line and into the 44px one for a control -- a remedy that carries its target into a stricter bar than the one that judged it. The expansion is shut until asked, so no picture had ever held one of these to measure. */}
              <Link
                to="/sites/$siteId"
                params={{ siteId: house.siteId }}
                className="min-w-0 truncate py-0.5 underline-offset-4 hover:underline"
              >
                {house.name}
              </Link>
              <span className="flex items-center gap-3">
                <Figure className="shrink-0">
                  {house.outstandingPaisa < 0
                    ? `${formatPaisa(-house.outstandingPaisa)} adv`
                    : formatPaisa(house.outstandingPaisa)}
                </Figure>
                {house.outstandingPaisa > 0 ? <Pay person={person} house={house} /> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

// Only the houses something is outstanding on. A man holding an advance is on this list because his balance belongs on it, and offering to pay him again is offering to deepen it.
function owingOn(person: Standing): Array<OnAHouse> {
  return person.onHouses.filter((house) => house.outstandingPaisa > 0)
}

// `Pay` as drawn, and it is a link rather than a button: what it does is open the day sheet for that house with him already chosen, which is a place rather than an action.

// The parameter is read by a route this file does not own. Written wrong it would open the right day sheet with nobody selected -- the screen would look correct and the man would have to find himself again, which is a workaround handed to him rather than a feature.
function Pay({ person, house }: { person: Standing; house: OnAHouse }) {
  return (
    <Link
      to="/sites/$siteId/day"
      params={{ siteId: house.siteId }}
      search={{ [PAYING]: person.personId }}
      aria-label={`Pay ${person.name} on ${house.name}`}
      className="border-input bg-card hover:border-brass hover:text-brass inline-flex min-h-11 shrink-0 items-center rounded-md border px-3 text-[0.8125rem] font-medium shadow-xs transition-colors pointer-fine:min-h-9"
    >
      Pay
    </Link>
  )
}

function Cell({
  label,
  tone,
  className,
  children,
}: {
  label: string
  tone?: string
  className?: string
  children: string
}) {
  // Neither of these may break. A phone was drawing `BILLED` as `BILLE` over `D`, and `883,701` as `883,7` over `01` -- a label a letter a line, and a figure that reads as a smaller figure rather than an incomplete one. Both are silent: `columns` measures what a cell occupies, and a wrapped cell occupies its box neatly, so the screen it was asked about came back clean while it drew that. Refusing the break is what turns it into something an instrument can see.
  return (
    <span className={cn('flex items-baseline justify-between gap-2 sm:justify-end', className)}>
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] whitespace-nowrap uppercase sm:hidden">
        {label}
      </span>
      <Figure className={`${tone ?? 'text-foreground'} text-right whitespace-nowrap`}>{children}</Figure>
    </span>
  )
}

// The shape of what is coming: the two tiles, then the table under them.
function OwedWaiting() {
  return (
    <WhileWaiting what="Working out what is owed">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((tile) => (
          <div key={tile} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-40 max-w-full" />
          </div>
        ))}
      </div>

      <div className="border-border bg-card flex flex-col rounded-xl border shadow-sm">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="border-border flex items-baseline justify-between gap-4 border-b px-5 py-3.5 last:border-0"
          >
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
