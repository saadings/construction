import { useState } from 'react'
import { asDayHeWrites } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { across } from '../dashboard/Bar'
import { Button } from '../form/Button'
import { WayOut } from '../form/WayOut'
import { Figure, NothingIsDeleted, SaidUnderneath } from '../shell/Page'
import { Panel } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { Table, TableBody, TableCell, TableRow } from '../ui/table'

export type TradeSpend = { tradeId: string; name: string; paisa: number }

export type WentOn = {
  _id: string
  day: string
  amountPaisa: number
  paidToName: string
  method: 'cheque' | 'cash' | 'transfer' | 'payOrder'
  reference?: string
  note?: string
}

// The words somebody would say, not the values underneath.
const SAID: Record<WentOn['method'], string> = {
  cheque: 'Cheque',
  cash: 'Cash',
  transfer: 'Transfer',
  payOrder: 'Pay order',
}

// A table rather than a list, and no width cap on it: this is the reason a desk is wider than a phone.

// Every figure here is a sum, and the payments behind it open underneath it. A wrong figure is a wrong payment, and this is where somebody looking for one goes.
export function SpentByTrade({
  byTrade,
  onOpen,
  opened,
  onTakeOut,
  takingOut,
  refusal,
}: {
  byTrade: Array<TradeSpend>
  // Which trade is open, and what went on it. Held by the page around this, because a reading belongs to whoever can ask for it.
  onOpen: (tradeId: string | null) => void
  opened: { tradeId: string; went: Array<WentOn> | null | undefined } | null
  onTakeOut: (paymentId: string) => Promise<boolean>
  takingOut: string | null
  refusal: string | null
}) {
  if (byTrade.length === 0) {
    return <p className="text-muted-foreground">Nothing spent on this house yet.</p>
  }

  // Against the largest rather than against the total, which is `Bar`'s rule and the reason it is shared: five categories where one is most of the spend leaves the other four a few percentage points apart, which is four bars nobody can compare.
  const largest = Math.max(...byTrade.map((trade) => trade.paisa))

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="leading-none font-semibold">Cost by category</h2>
        <p className="text-muted-foreground text-[0.8125rem]">Everything paid on this site since it started</p>
      </div>

      {/* `Table` scrolls inside itself rather than pushing the page sideways, which is what a narrow phone does to a table. The size is set back because shadcn's table is `text-sm` and a trade and its figure are the thing on this screen, not an aside from it. */}
      <Table className="min-w-[19rem] text-base">
        <TableBody>
          {byTrade.map((trade) => {
            const open = opened?.tradeId === trade.tradeId

            return (
              <Trade
                key={trade.tradeId}
                trade={trade}
                open={open}
                went={open ? opened.went : undefined}
                onOpen={() => onOpen(open ? null : trade.tradeId)}
                onTakeOut={onTakeOut}
                takingOut={takingOut}
                refusal={open ? refusal : null}
                largest={largest}
              />
            )
          })}
        </TableBody>
      </Table>
    </Panel>
  )
}

function Trade({
  trade,
  open,
  went,
  onOpen,
  onTakeOut,
  takingOut,
  refusal,
  largest,
}: {
  trade: TradeSpend
  open: boolean
  went: Array<WentOn> | null | undefined
  onOpen: () => void
  onTakeOut: (paymentId: string) => Promise<boolean>
  takingOut: string | null
  refusal: string | null
  /** What the biggest category on this house comes to, so every bar is drawn against the same thing. */
  largest: number
}) {
  return (
    <>
      <TableRow>
        {/* A trade is somebody's words and can be long, so it wraps rather than pushing its own figure off the side. `Table` cells do not wrap by default, which is right for a figure and wrong for a name. */}
        <TableCell className="py-2.5 pr-4 whitespace-normal">
          <Button look="another" className="text-foreground text-left" onClick={onOpen} aria-expanded={open}>
            {trade.name}
          </Button>
        </TableCell>
        {/* The bar he drew. The row stays a control -- opening a category is where a wrong figure is found and taken back out, which his drawing has no equivalent of -- so this is his shape inside our behaviour rather than either one replacing the other. */}

        {/* Gone on a phone rather than squeezed into it. Three things across 390 left the category at 73px and eight lines tall -- a column squeezed to a letter a line is a column that should have left the row, which is what the sweep says about it. The name and the figure are what a person reads; the bar is what makes them comparable at a glance, and a glance is a desk. */}
        <TableCell className="hidden w-[38%] py-2.5 sm:table-cell">
          <span className="bg-muted flex h-4 overflow-hidden rounded-sm">
            <span
              data-bar=""
              className="bg-brass/85 block h-full"
              style={{ width: `${String(across(trade.paisa, largest))}%` }}
            />
          </span>
        </TableCell>

        {/* Brass is money going out. */}
        <TableCell className="py-2.5 text-right">
          <Figure className="text-brass">{formatPaisa(trade.paisa)}</Figure>
        </TableCell>
      </TableRow>

      {open ? (
        <TableRow>
          <TableCell colSpan={3} className="pb-3 whitespace-normal">
            {refusal === null ? null : (
              <p className="text-destructive pb-2 text-sm" role="alert">
                {refusal}
              </p>
            )}
            <WhatWentOnIt went={went} onTakeOut={onTakeOut} takingOut={takingOut} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function WhatWentOnIt({
  went,
  onTakeOut,
  takingOut,
}: {
  went: Array<WentOn> | null | undefined
  onTakeOut: (paymentId: string) => Promise<boolean>
  takingOut: string | null
}) {
  if (went === undefined) {
    return <SpendingWaiting />
  }

  if (went === null) {
    return null
  }

  if (went.length === 0) {
    return <p className="text-muted-foreground py-2 text-sm">Nothing on this one any more.</p>
  }

  return (
    <ul className="divide-hairline bg-panel flex flex-col divide-y rounded-md px-3">
      {went.map((one) => (
        <Payment key={one._id} went={one} onTakeOut={onTakeOut} takingOut={takingOut === one._id} />
      ))}
    </ul>
  )
}

function Payment({
  went,
  onTakeOut,
  takingOut,
}: {
  went: WentOn
  onTakeOut: (paymentId: string) => Promise<boolean>
  takingOut: boolean
}) {
  // Asked once and then done, in place. A payment cannot be put back from a screen, so the second press is the whole of what stands between a slip of the thumb and a figure disappearing.
  const [asking, setAsking] = useState(false)

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[0.9375rem]">{went.paidToName}</p>

        {/* Truncated until a picture was taken of it: at 390 this read `23/07/2026 · Chequ…` and the cheque number was gone entirely, on the screen where somebody checks which cheque paid what. The bill list two screens away had already been fixed for this and this one was written the old way beside it, which is what a rule with no instrument does. */}
        <SaidUnderneath pieces={[asDayHeWrites(went.day), SAID[went.method], went.reference, went.note]} />
      </div>

      <Figure className="text-brass shrink-0 text-[0.9375rem]">{formatPaisa(went.amountPaisa)}</Figure>

      {asking ? (
        <span className="flex shrink-0 items-baseline gap-3">
          {/* The word `Hide` used to be the whole of this promise, and `NothingIsDeleted` is where it went: said where somebody is deciding rather than carried by a verb that then reads as a display switch. */}
          <span className="text-muted-foreground text-sm">Remove this?</span>
          <Button
            look="removing"
            onClick={() => {
              void onTakeOut(went._id)
            }}
            disabled={takingOut}
          >
            {takingOut ? 'Removing…' : 'Yes, remove'}
          </Button>
          <WayOut onClick={() => setAsking(false)}>Cancel</WayOut>
          <NothingIsDeleted />
        </span>
      ) : (
        <WayOut
          onClick={() => setAsking(true)}
          aria-label={`Remove ${formatPaisa(went.amountPaisa)} paid to ${went.paidToName}`}
          className="shrink-0"
        >
          Remove
        </WayOut>
      )}
    </li>
  )
}

// The shape of what is coming: two payments, a name and a figure each.
function SpendingWaiting() {
  return (
    <WhileWaiting what="Getting what went on it">
      <div className="bg-panel flex flex-col gap-3 rounded-md px-3 py-3">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
