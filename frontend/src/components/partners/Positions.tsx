import type { ReactNode } from 'react'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
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
const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]'

// Basis points read back as the percentage somebody said out loud: 3333 is 33.33%, and 7500 is 75% rather than 75.00%.
function asPercent(basisPoints: number): string {
  return `${String(Math.round(basisPoints) / 100)}%`
}

// Handed the read as it came. `undefined` is still on its way; `null` is the house not being there, which the page around this has already said. Answering either on its behalf is how a screen ends up watching for something that is not coming.

// The way to the screen that sets these is handed in rather than built here, so this stays a thing that reads and the page around it keeps knowing where its own links go.
export function Positions({ what, beside }: { what: WhatThePartnersHave | null | undefined; beside?: ReactNode }) {
  if (what === undefined) {
    return <PositionsWaiting />
  }

  if (what === null) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-foreground text-base font-medium">What each partner is owed</h2>
        <p className="text-muted-foreground flex items-baseline gap-3 text-sm">
          <span>{what.sharesAgreed ? 'Shares agreed between them.' : 'Shares follow what each of them put in.'}</span>
          {beside}
        </p>
      </div>

      <Profit what={what} />

      {what.positions.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          Nobody has put money into this house yet. Put a partner’s money in and the shares work themselves out.
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
          >
            <span>Partner</span>
            <span className="text-right">Put in</span>
            <span className="text-right">Share</span>
            <span className="text-right">Due</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Left</span>
          </div>

          <ul className="divide-hairline flex flex-col divide-y">
            {what.positions.map((position) => (
              <li key={position.personId} className={`${ROW} py-3.5`}>
                <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{position.name}</span>

                <Cell label="Put in">{formatPaisa(position.capitalPaisa)}</Cell>
                <Cell label="Share">{asPercent(position.basisPoints)}</Cell>
                {/* Nothing is due until the house is sold, and a dash says that better than a zero, which reads as a figure somebody worked out. */}
                <Cell label="Due">{what.sold ? formatPaisa(position.duePaisa) : '—'}</Cell>
                {/* Brass, because it is money that has gone out to him. */}
                <Cell label="Paid" tone="text-brass">
                  {formatPaisa(position.paidPaisa)}
                </Cell>
                {/* Green, because what is left is money the partnership still owes him. */}
                <Cell label="Left" tone="text-green">
                  {formatPaisa(position.balancePaisa)}
                </Cell>
              </li>
            ))}
          </ul>
        </div>
      )}

      {what.ifItSoldToday === null ? null : <IfItSoldToday what={what.ifItSoldToday} />}
    </section>
  )
}

// The shape of what is coming: the three figures above, then the table under them. The heading is real from the first frame, because it is known before the reading arrives and a grey bar where a known word goes promises something it does not have to.
function PositionsWaiting() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-base font-medium">What each partner is owed</h2>

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

function Profit({ what }: { what: WhatThePartnersHave }) {
  return (
    <dl className="border-border bg-panel grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border px-4 py-3 sm:grid-cols-3">
      <Sum label="Come in">{formatPaisa(what.broughtInPaisa)}</Sum>
      <Sum label="Gone out" tone="text-brass">
        {formatPaisa(what.spentPaisa)}
      </Sum>
      <Sum label={what.profitPaisa < 0 ? 'Out of pocket by' : 'Profit'}>{formatPaisa(Math.abs(what.profitPaisa))}</Sum>
    </dl>
  )
}

function Sum({ label, tone, children }: { label: string; tone?: string; children: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase">{label}</dt>
      <dd className={`${tone ?? 'text-foreground'} text-lg`}>
        <Figure>{children}</Figure>
      </dd>
    </div>
  )
}
