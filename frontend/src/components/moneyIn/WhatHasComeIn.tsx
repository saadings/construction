import { Link } from '@tanstack/react-router'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { Table, TableBody, TableCell, TableRow } from '../ui/table'

// What has come in on a house, beside what it has cost. Three figures rather than one, because they are not the same kind of money: a partner putting his share in is funding the house, and what a client pays and what a sale brings are what the house brought in.

// The distinction the whole profit split stands on. Counting capital as income makes a house look profitable the moment somebody funds it.
export type ComeIn = {
  byWhy: { partnerMoney: number; clientPayment: number; sale: number }
  receivedPaisa: number
}

// Said the way he would say it, and in the order money arrives on a house: the partners put in first, the client pays against his bill, and a sale comes last if it comes at all.
const SPLIT = [
  { why: 'partnerMoney' as const, label: 'Partner investment', is: 'Partner investment' },
  { why: 'clientPayment' as const, label: 'Client payment', is: 'Client & sale' },
  { why: 'sale' as const, label: 'Sale proceeds', is: 'Client & sale' },
]

export function WhatHasComeIn({ siteId, totals }: { siteId: string; totals: ComeIn | null | undefined }) {
  if (totals === undefined) {
    return (
      <WhileWaiting what="Getting what has come in">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-56 max-w-full" />
        <div className="divide-hairline mt-2 flex flex-col divide-y">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2.5">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-4 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </WhileWaiting>
    )
  }

  // The read came back and refused. Every other read on this house came back, so a zero here would be a figure nobody gave.
  if (totals === null) {
    return (
      <section className="flex flex-col gap-2">
        <Heading>Come in</Heading>
        <p className="text-muted-foreground">What has come in did not come back. Open the house again.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <Heading>Come in</Heading>
          {/* Green is money coming to the partnership rather than leaving it, the same as everywhere else it is shown. */}
          <Figure className="text-green text-[2.5rem] leading-none">{formatPaisa(totals.receivedPaisa)}</Figure>
        </div>

        {/* `Put money in` until he read it on the screen and called it poor English, wanting one meaningful word. `Add` is his own register -- his Settings screen puts a bare `Add` on both of its cards -- and it sits directly under the heading it adds to, which is what makes one word enough here and not enough in a header. */}
        <Link
          to="/sites/$siteId/coming-in"
          params={{ siteId }}
          className="border-border text-foreground shrink-0 rounded-md border px-4 py-3 text-sm font-medium"
        >
          Add
        </Link>
      </div>

      {/* The size is set back because shadcn's table is `text-sm`, and these three lines are the reading, not a footnote under it. */}

      {/* No minimum width: at 390 the 22rem it asked for cut `6,540,000` by 17px, and a figure cut in half reads as a smaller figure. The middle column is what says one of these three is funding rather than income, so it is not the one to drop -- both words columns wrap instead and the figures stay whole. */}
      <Table className="text-base">
        <TableBody>
          {SPLIT.map((part) => (
            <TableRow key={part.why}>
              <TableCell className="text-foreground py-2.5 pr-4 whitespace-normal">{part.label}</TableCell>
              {/* What kind of money it is, said on the row. Three figures under one heading read as three parts of one thing, and one of these is not. */}
              <TableCell className="text-muted-foreground py-2.5 pr-4 text-sm whitespace-normal">{part.is}</TableCell>
              <TableCell className="py-2.5 text-right">
                <Figure className="text-foreground">{formatPaisa(totals.byWhy[part.why])}</Figure>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground max-w-prose text-sm">
        What the partners put in is funding, not income. It is here because it came in, and it is kept apart because a
        house is not profitable the moment somebody funds it.
      </p>
    </section>
  )
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{children}</h2>
}
