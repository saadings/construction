import type { ReactNode } from 'react'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Heading, Panel, TablePanel } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type Position = {
  personId: string
  name: string
  capitalPaisa: number
  basisPoints: number
  duePaisa: number
  paidPaisa: number
  balancePaisa: number
}

export type WhatThePartnersHave = {
  positions: Array<Position>
  broughtInPaisa: number
  spentPaisa: number
  profitPaisa: number
  sold: boolean
  sharesAgreed: boolean
  // What a share would come to if the house sold today. Never in the table above, and gone once it really is sold.
  ifItSoldToday: { profitPaisa: number; shares: Array<{ personId: string; name: string; paisa: number }> } | null
}

// The same markup at every width. A phone gets the name and what is left; a desk gets what he put in, his share, what he is owed and what he has had as well.

// One grid for the whole list, and every row takes its columns from it. Written per row, each row sized its own `auto` track to its own content -- not seen to move today, and not defended against it either: every last cell happens to be a figure of much the same width.
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]'

/** A row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

/** Everything between the grid and a row -- a list, a list item -- which has to pass the columns down rather than stop them. */
const PASSES_THEM_DOWN = 'col-span-full grid grid-cols-subgrid'

// Basis points read back as the percentage somebody said out loud: 3333 is 33.33%, and 7500 is 75% rather than 75.00%.
function asPercent(basisPoints: number): string {
  return `${String(Math.round(basisPoints) / 100)}%`
}

// Green while it is money still owed to him. Brass where it has gone the other way -- he has drawn more than his share came to -- because that is not a debt of the partnership's. Neither before the house sells, where the cell holds a dash and a colour on it would be saying something about a figure that is not there.
function howTheBalanceReads(sold: boolean, balancePaisa: number): string | undefined {
  if (!sold) return undefined

  return balancePaisa < 0 ? 'text-brass' : 'text-green'
}

// Handed the read as it came. `undefined` is still on its way; `null` is the house not being there, which the page around this has already said. Answering either on its behalf is how a screen ends up watching for something that is not coming.

// The ways to the screens that change these are handed in rather than built here, so this stays a thing that reads and the page around it keeps knowing where its own links go.
export function Positions({
  what,
  beside,
  beneath,
}: {
  what: WhatThePartnersHave | null | undefined
  beside?: ReactNode
  beneath?: ReactNode
}) {
  if (what === undefined) {
    return <PositionsWaiting />
  }

  if (what === null) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      {/* The drawn language: a heading with the count of what is under it, and the note beside rather than beneath. This screen has no drawing of its own -- the partner half was left out of the design and Nauman asked for it back -- so it is built from the same pieces the drawn ones are. */}
      <Heading said="Owed to partners" count={what.positions.length}>
        <span className="text-muted-foreground text-[0.8125rem]">
          {what.sharesAgreed ? 'Shares agreed between them.' : 'Shares follow what each of them put in.'}
        </span>
      </Heading>
      {beside === undefined ? null : (
        <p className="text-muted-foreground flex items-baseline gap-3 text-sm">{beside}</p>
      )}

      <Profit what={what} />

      {what.positions.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          Nobody has put money into this house yet. Put a partner’s money in and the shares work themselves out.
        </p>
      ) : (
        <TablePanel>
          <div className={GRID}>
            <div
              className={`${ROW} text-muted-foreground border-border hidden border-b px-5 py-2.5 text-[0.75rem] font-semibold sm:grid`}
            >
              <span>Partner</span>
              <span className="text-right">Put in</span>
              <span className="text-right">Share</span>
              <span className="text-right">Due</span>
              <span className="text-right">Paid</span>
              <span className="text-right">Remaining</span>
            </div>

            <ul className={PASSES_THEM_DOWN}>
              {what.positions.map((position) => (
                <li
                  key={position.personId}
                  className={`${ROW} border-border hover:bg-muted/60 border-b px-5 py-3.5 transition-colors last:border-0`}
                >
                  <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{position.name}</span>

                  <Cell label="Put in">{formatPaisa(position.capitalPaisa)}</Cell>
                  <Cell label="Share">{asPercent(position.basisPoints)}</Cell>
                  {/* Nothing is due until the house is sold, and a dash says that better than a zero, which reads as a figure somebody worked out. */}
                  <Cell label="Due">{what.sold ? formatPaisa(position.duePaisa) : '—'}</Cell>
                  {/* Brass, because it is money that has gone out to him. The one figure on this row that is real before the house sells. */}
                  <Cell label="Paid" tone="text-brass">
                    {formatPaisa(position.paidPaisa)}
                  </Cell>
                  {/* A dash for the same reason `Due` has one, and it took a payout going in to find out why it matters: nothing is due until the house sells, so a partner paid ahead of the sale reads as owed minus paid, which is a negative figure in a column headed Left. That reads as the partnership owing him, when he is the one who has had money early. */}
                  <Cell label="Remaining" tone={howTheBalanceReads(what.sold, position.balancePaisa)}>
                    {what.sold ? formatPaisa(position.balancePaisa) : '—'}
                  </Cell>
                </li>
              ))}
            </ul>
          </div>
        </TablePanel>
      )}

      {/* Said out loud rather than left to be worked out from two dashes and a figure. Only where it is true: somebody has been paid on a house that has not sold. */}
      {!what.sold && what.positions.some((position) => position.paidPaisa > 0) ? (
        <p className="text-muted-foreground max-w-prose text-sm">
          Nothing is due until this house sells. What is under <span className="text-foreground">Paid</span> has gone
          back to them ahead of it.
        </p>
      ) : null}

      {beneath}

      {what.ifItSoldToday === null ? null : <IfItSoldToday what={what.ifItSoldToday} />}
    </section>
  )
}

// The shape of what is coming: the three figures above, then the table under them. The heading is real from the first frame, because it is known before the reading arrives and a grey bar where a known word goes promises something it does not have to.
function PositionsWaiting() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-base font-medium">Owed to partners</h2>

      <WhileWaiting what="Working out what each partner is owed">
        <div className="border-border bg-panel grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border px-4 py-3 sm:grid-cols-3">
          {[0, 1, 2].map((sum) => (
            <div key={sum} className="flex flex-col gap-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>

        <div className="divide-hairline flex flex-col divide-y">
          {/* Two, because a house is built by a handful of partners and a screenful of grey bars promises a longer table than is coming. */}
          {[0, 1].map((row) => (
            <div key={row} className={`${ROW} py-3.5`}>
              <Skeleton className="h-4 w-32" />
              {[0, 1, 2, 3, 4].map((cell) => (
                <Skeleton key={cell} className="ml-auto hidden h-4 w-16 sm:block" />
              ))}
              <Skeleton className="ml-auto h-4 w-20 sm:hidden" />
            </div>
          ))}
        </div>
      </WhileWaiting>
    </section>
  )
}

// Under the table and never in it. A guess about a house still being built is not what anybody is owed, and the moment the two sit in one column somebody reads one for the other.
function IfItSoldToday({ what }: { what: NonNullable<WhatThePartnersHave['ifItSoldToday']> }) {
  return (
    <div className="border-border flex flex-col gap-2 rounded-md border border-dashed px-4 py-3">
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">If this sold today</span> — an estimate, not owed to anybody yet.
      </p>

      <ul className="flex flex-col gap-1">
        {what.shares.map((share) => (
          <li key={share.personId} className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground min-w-0 truncate text-sm">{share.name}</span>
            <Figure className="text-muted-foreground text-sm">{formatPaisa(share.paisa)}</Figure>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The label rides with the figure on a phone, where there is no column heading above it to say what it is.
function Cell({ label, tone, children }: { label: string; tone?: string; children: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 sm:justify-end">
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase sm:hidden">{label}</span>
      <Figure className={`${tone ?? 'text-foreground'} text-right`}>{children}</Figure>
    </span>
  )
}

// Three tiles rather than one strip, which is how every drawn screen carries its totals: a card each, so a figure is a thing on the page rather than a column of a table nobody drew.
function Profit({ what }: { what: WhatThePartnersHave }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Sum label="Invested">{formatPaisa(what.broughtInPaisa)}</Sum>
      <Sum label="Expenses" tone="text-brass">
        {formatPaisa(what.spentPaisa)}
      </Sum>
      <Sum label={what.profitPaisa < 0 ? 'Out of pocket by' : 'Profit'}>{formatPaisa(Math.abs(what.profitPaisa))}</Sum>
    </dl>
  )
}

function Sum({ label, tone, children }: { label: string; tone?: string; children: string }) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <dt className="text-faint text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">{label}</dt>
      <dd className={`${tone ?? 'text-foreground'} text-[1.6875rem] leading-none`}>
        <Figure>{children}</Figure>
      </dd>
    </Panel>
  )
}
