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

// One grid for the whole list, and every row takes its columns from it. Written per row, each row would size its own track to whatever happened to be in it, and a column that moves between rows is what makes a table stop reading as a table.
const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[7.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]'

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
              className={`${ROW} text-muted-foreground border-border hidden border-b px-5 py-2.5 text-[0.75rem] font-semibold sm:grid`}
            >
              <span>Day</span>
              <span>House</span>
              <span>From</span>
              <span>What it is</span>
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
function TheThreeKinds({ everything }: { everything: EverythingIn }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Green is money coming to the partnership rather than leaving it, the same as everywhere else it is shown. */}
      <Tile label="Come in" tone="text-green">
        <Figure>{formatPaisa(everything.receivedPaisa)}</Figure>
      </Tile>
      <Tile
        label="Partner investment"
        beneath="Funding rather than income: a house is not profitable the moment somebody funds it."
      >
        <Figure>{formatPaisa(everything.byWhy.partnerMoney)}</Figure>
      </Tile>
      <Tile label="Client payment">
        <Figure>{formatPaisa(everything.byWhy.clientPayment)}</Figure>
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
      {/* The day as he writes it, and the cheque number under it rather than beside: a cheque number cut short is not a cheque number, and this is one of the screens somebody checks one against. */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <Figure className="text-muted-foreground text-sm">{asDayHeWrites(receipt.day)}</Figure>
        <SaidUnderneath pieces={[HOW[receipt.method], receipt.reference, receipt.note]} className="text-[0.8125rem]" />
      </span>

      <span className="text-foreground order-first min-w-0 truncate text-[1.0625rem] sm:order-none sm:text-base">
        {receipt.siteName}
      </span>
      <span className="text-muted-foreground col-span-2 min-w-0 truncate text-sm sm:col-span-1">
        {receipt.fromName}
      </span>
      <span className="text-muted-foreground col-span-2 text-sm sm:col-span-1">{SAID[receipt.why]}</span>

      <Figure className="text-green order-first text-right sm:order-none">{formatPaisa(receipt.amountPaisa)}</Figure>
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
