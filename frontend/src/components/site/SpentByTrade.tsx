import { useState } from 'react'
import { asDayHeWrites } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { Button } from '../form/Button'
import { WayOut } from '../form/WayOut'
import { Figure } from '../shell/Page'
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

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">What it went on</h2>

      {/* `Table` scrolls inside itself rather than pushing the page sideways, which is what a narrow phone does to a table. The size is set back because shadcn's table is `text-sm` and a trade and its figure are the thing on this screen, not an aside from it. */}
      <Table className="min-w-[22rem] text-base">
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
              />
            )
          })}
        </TableBody>
      </Table>
    </section>
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
}: {
  trade: TradeSpend
  open: boolean
  went: Array<WentOn> | null | undefined
  onOpen: () => void
  onTakeOut: (paymentId: string) => Promise<boolean>
  takingOut: string | null
  refusal: string | null
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
        {/* Brass is money going out. */}
        <TableCell className="py-2.5 text-right">
          <Figure className="text-brass">{formatPaisa(trade.paisa)}</Figure>
        </TableCell>
      </TableRow>

      {open ? (
        <TableRow>
          <TableCell colSpan={2} className="pb-3 whitespace-normal">
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
        <p className="text-muted-foreground truncate text-sm">
          {asDayHeWrites(went.day)} · {SAID[went.method]}
          {went.reference === undefined ? '' : ` · ${went.reference}`}
          {went.note === undefined ? '' : ` · ${went.note}`}
        </p>
      </div>

      <Figure className="text-brass shrink-0 text-[0.9375rem]">{formatPaisa(went.amountPaisa)}</Figure>

      {asking ? (
        <span className="flex shrink-0 items-baseline gap-3">
          {/* Said plainly, because it is the truth and because somebody worried about losing a record should be able to read that they are not. */}
          <span className="text-muted-foreground text-sm">Hide it?</span>
          <Button
            look="removing"
            onClick={() => {
              void onTakeOut(went._id)
            }}
            disabled={takingOut}
          >
            {takingOut ? 'Taking it out…' : 'Yes, take it out'}
          </Button>
          <WayOut onClick={() => setAsking(false)}>Never mind</WayOut>
        </span>
      ) : (
        <WayOut
          onClick={() => setAsking(true)}
          aria-label={`Take out ${formatPaisa(went.amountPaisa)} paid to ${went.paidToName}`}
          className="shrink-0"
        >
          Take out
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
