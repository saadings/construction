import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { asDayHeWrites } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { NotKnownHere } from '../shell/NotKnownHere'
import { Figure, Page, SaidUnderneath } from '../shell/Page'
import { TablePanel, Tile } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type WhyItCame = 'partnerMoney' | 'clientPayment' | 'sale'

export type Receipt = {
  _id: string
  day: string
  amountPaisa: number
  why: WhyItCame
  method: 'cheque' | 'cash' | 'transfer' | 'payOrder'
  reference?: string
  note?: string
  siteId: string
  siteName: string
  fromName: string
}

export type EverythingIn = {
  receipts: Array<Receipt>
  byWhy: Record<WhyItCame, number>
  receivedPaisa: number
}

// Money arriving, over every house at once. A house's own screen already answers what came in on that house; this is the question nobody could ask the workbooks -- what has come in altogether, and where it came from.

// The words are the ones a house already uses for the same three kinds, because the same money read on two screens under two names is two things to whoever is reading.
const SAID: Record<WhyItCame, string> = {
  partnerMoney: 'Partner investment',
  clientPayment: 'Client payment',
  sale: 'Sale proceeds',
}

const HOW: Record<Receipt['method'], string> = {
  cheque: 'Cheque',
  cash: 'Cash',
  transfer: 'Transfer',
  payOrder: 'Pay order',
}

/** What the screen is, said where the drawing says it. */
const WHAT_THIS_IS =
  'Money arriving: a partner putting his share in, a client paying against his house, or a house sold.'

// Six columns from `lg`, not `sm`: the drawing gives this table `min-w-[980px]` and never draws it narrower, and at 768 it wrapped `Client payment` and cut every name.

// One grid for the whole list, and every row takes its columns from it. Written per row, each row would size its own track to whatever happened to be in it, and a column that moves between rows is what makes a table stop reading as a table.
const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'

/** A row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

// The way in, in his own words for the screen it opens. His `Receipts` list has one and ours had none at all -- so `Receipts` was a screen you could read and not write to, and the second card of the `New entry` dialog had nowhere to land.
function RecordOne() {
  return (
    <Link
      to="/money-in/new"
      className="border-input bg-card hover:border-brass flex min-h-11 items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium shadow-xs transition-colors pointer-fine:min-h-9"
    >
      <Plus aria-hidden className="text-brass size-4 shrink-0" />
      Record a receipt
    </Link>
  )
}

export function EverythingThatCameIn({ everything }: { everything: EverythingIn | null | undefined }) {
  if (everything === undefined) {
    return (
      <Page title="Receipts" said={WHAT_THIS_IS} beside={<RecordOne />}>
        <MoneyInWaiting />
      </Page>
    )
  }

  // The ledger has answered and does not know this sign-in. Nothing on this screen would work, so it offers none of it.
  if (everything === null) {
    return (
      <Page title="Receipts" said={WHAT_THIS_IS} beside={<RecordOne />}>
        <NotKnownHere />
      </Page>
    )
  }

  return (
    <Page title="Receipts" said={WHAT_THIS_IS} beside={<RecordOne />}>
      <TheThreeKinds everything={everything} />

      {everything.receipts.length === 0 ? (
        <p className="text-muted-foreground max-w-prose py-6">
          Nothing has come in yet. Money put in on a house lands here, whichever house it was.
        </p>
      ) : (
        <TablePanel>
          <div className={GRID}>
            <div
              className={`${ROW} text-muted-foreground border-border hidden border-b px-5 py-2.5 text-[0.75rem] font-semibold lg:grid`}
            >
              <span>Day</span>
              <span>House</span>
              <span>From</span>
              <span>What it is</span>
              <span>How</span>
              <span className="text-right">Amount</span>
            </div>

            <ul className={ROW}>
              {everything.receipts.map((receipt) => (
                <One key={receipt._id} receipt={receipt} />
              ))}
            </ul>
          </div>
        </TablePanel>
      )}
    </Page>
  )
}

// The drawing puts three tiles over this table and the third of the three kinds is not one of them, so the total beside them would be more than the two under it add up to. Four, because there are four figures: what has come in, and the three kinds it is made of.

// The order is the drawing's -- total, then clients, then partners -- rather than the one this file had. The labels are not: they are what a house's own screen calls the same three kinds, and the same money under two names on two screens is two things to whoever reads it.
function TheThreeKinds({ everything }: { everything: EverythingIn }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* The drawing calls this `Received this year`. Ours is every year there has been, so that is not a longer label but a false one. */}
      <Tile label="Received" tone="text-green">
        <Figure>{formatPaisa(everything.receivedPaisa)}</Figure>
      </Tile>
      {/* The drawing says `Against 12-C's 42,500,000 contract` under this one. That is a client's contract measured against what he has paid, and this screen holds neither figure -- so it says nothing rather than promising a door that does not open. */}
      <Tile label="Client payment">
        <Figure>{formatPaisa(everything.byWhy.clientPayment)}</Figure>
      </Tile>
      <Tile
        label="Partner investment"
        beneath="Funding rather than income: a house is not profitable the moment somebody funds it."
      >
        <Figure>{formatPaisa(everything.byWhy.partnerMoney)}</Figure>
      </Tile>
      <Tile label="Sale proceeds">
        <Figure>{formatPaisa(everything.byWhy.sale)}</Figure>
      </Tile>
    </dl>
  )
}

function One({ receipt }: { receipt: Receipt }) {
  return (
    <li className={`${ROW} border-border hover:bg-row-hover border-b px-5 py-3.5 transition-colors last:border-0`}>
      <Figure className="text-muted-foreground order-3 text-sm lg:order-none">{asDayHeWrites(receipt.day)}</Figure>

      <span className="text-foreground order-1 min-w-0 truncate text-[1.0625rem] lg:order-none lg:text-base">
        {receipt.siteName}
      </span>

      <span className="text-muted-foreground order-5 col-span-2 min-w-0 truncate text-sm lg:order-none lg:col-span-1">
        {receipt.fromName}
      </span>

      {/* What it is, and anything written against it underneath. The drawing has nowhere for a note; dropping it would be losing something somebody typed, and what a receipt was for is the thing it explains. */}
      <span className="order-6 col-span-2 flex min-w-0 flex-col gap-0.5 lg:order-none lg:col-span-1">
        <span className="text-muted-foreground text-sm">{SAID[receipt.why]}</span>
        {receipt.note === undefined ? null : (
          <span className="text-muted-foreground text-[0.8125rem]">{receipt.note}</span>
        )}
      </span>

      {/* A column of its own, as drawn, and untruncated unlike the drawing: a cheque number cut short is not a cheque number. */}
      <SaidUnderneath
        pieces={[HOW[receipt.method], receipt.reference]}
        className="order-4 text-right text-[0.8125rem] lg:order-none lg:text-left"
      />

      <Figure className="text-green order-2 text-right lg:order-none">{formatPaisa(receipt.amountPaisa)}</Figure>
    </li>
  )
}

// The shape of what is coming: the four figures, then the list under them.
function MoneyInWaiting() {
  return (
    <WhileWaiting what="Getting what has come in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-36 max-w-full" />
          </div>
        ))}
      </div>

      <div className="border-border bg-card flex flex-col rounded-xl border shadow-sm">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="border-border flex items-baseline justify-between gap-4 border-b px-5 py-3.5 last:border-0"
          >
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
