import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'

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
  sharesAgreed: boolean
}

// The same markup at every width. A phone gets the name and what is left; a desk gets what he put in, his share, what he is owed and what he has had as well.
const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]'

// Basis points read back as the percentage somebody said out loud: 3333 is 33.33%, and 7500 is 75% rather than 75.00%.
function asPercent(basisPoints: number): string {
  return `${String(Math.round(basisPoints) / 100)}%`
}

export function Positions({ what }: { what: WhatThePartnersHave | null }) {
  if (what === null) {
    return <p className="text-muted-foreground text-sm">Looking…</p>
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-foreground text-base font-medium">What each partner is owed</h2>
        <p className="text-muted-foreground text-sm">
          {what.sharesAgreed ? 'Shares agreed between them.' : 'Shares follow what each of them put in.'}
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
                <Cell label="Due">{formatPaisa(position.duePaisa)}</Cell>
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
    </section>
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
