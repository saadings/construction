import { Link } from '@tanstack/react-router'
import { ChartNoAxesColumn } from 'lucide-react'
import { asTheDayInFull } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { inWords } from '../inWords'
import { Figure, Page } from '../shell/Page'
import { Tile } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { InAndOut } from './InAndOut'
import { NeedsYourAttention } from './NeedsYourAttention'
import type { House } from './TheSites'
import { TheSites } from './TheSites'
import { WhereItWent } from './WhereItWent'

// Everything at once, across every house. Nauman's word for it, and the one place in this app using a software term rather than the words on his own screens.

// Every figure here is one the ledger already answers. Nothing is worked out for a tile, because a number nobody can go and find the rows behind is a number nobody can act on.
export type WhatIsHappening = {
  /** The day the figures were counted for, handed back by the query that counted them. The heading says it, and a heading naming a different day from the figures under it is worse than no heading at all. */
  asAt: string
  owed: { payablePaisa: number; advancedPaisa: number; people: number }
  goneOutPaisa: number
  comeIn: { receivedPaisa: number; ownMoneyPaisa: number }
  thisMonth: { month: string; paidOutPaisa: number; entries: number; receivedPaisa: number }
  whereItWent: Array<{ tradeId: string | null; name: string; paisa: number }>
  inAndOut: Array<{ month: string; inPaisa: number; outPaisa: number }>
  quietDays: Array<string>
  houses: Array<House>
  nothingYet: boolean
}

export function Dashboard({ what }: { what: WhatIsHappening | null | undefined }) {
  if (what === undefined) {
    return (
      <Page title="Dashboard">
        <Waiting />
      </Page>
    )
  }

  if (what === null) {
    return (
      <Page title="Dashboard">
        <p className="text-muted-foreground max-w-prose">
          This did not come back. Sign out and in again, and if it is still here after that, something is wrong at our
          end rather than yours.
        </p>
      </Page>
    )
  }

  // His own line under the title. `active` is his word and it is not ours to claim: a site is shown or hidden here and nothing knows whether work is going on at one, so this counts what is on the screen and says only that.
  const said = `${inWords(what.houses.length)} ${what.houses.length === 1 ? 'site' : 'sites'} · figures as at ${asTheDayInFull(what.asAt)}`

  return (
    <Page title="Dashboard" said={what.nothingYet ? undefined : said} beside={<FullReports />}>
      {/* Not a fallback. His first day is one house with nothing in it, and a dashboard drawing charts over four zeroes is what everybody ships. */}
      {what.nothingYet ? <NothingYet houses={what.houses.length} /> : <Everything what={what} />}
    </Page>
  )
}

// His header button, and the second way to `Reports` on this screen -- the rail is the first. Kept because it is drawn: the tiles above it are a summary, and somebody who wants the whole of it should not have to find the nav to say so.
function FullReports() {
  return (
    <Link
      to="/reports"
      className="border-input bg-card hover:border-brass flex min-h-11 items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium shadow-xs transition-colors pointer-fine:min-h-9"
    >
      <ChartNoAxesColumn aria-hidden className="text-brass size-4 shrink-0" />
      Full reports
    </Link>
  )
}

function Everything({ what }: { what: WhatIsHappening }) {
  // What has come in and not gone out again. The ledger's own subtraction and nothing more, which is why it is not called cash: an opening balance per account is a thing nothing here holds, and there is history behind this ledger whose outgoings were never entered.
  const notYetSpent = what.comeIn.receivedPaisa - what.goneOutPaisa

  return (
    <div className="flex flex-col gap-7">
      <NeedsYourAttention what={what} />

      {/* A `dl` because `Tile` renders `dt` and `dd`: what each figure is, and the figure. */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* His first tile is `Cash on hand`, over `Two bank accounts and cash`. Nothing here holds an opening balance, so that figure cannot be answered and is not guessed at. This is the true version of the same idea, and `Cash on hand` is on the list going back to him. */}

        {/* The caveat is on the tile and not in a comment, which is the whole difference between a figure and a wrong figure. A sentence in the source ships to nobody, and this one is the only thing standing between this figure and being read as a bank balance. */}

        {/* Said in a word rather than by a sign, which is what this app does everywhere money can go the other way: `Payables` shows an advance as its own amount followed by `adv` rather than as a negative balance. A minus in front of a figure is a thing somebody reads past. */}
        <Tile
          label={notYetSpent < 0 ? 'Spent past what came in' : 'Not yet spent'}
          tone={notYetSpent < 0 ? 'text-brass' : 'text-green'}
          beneath={
            notYetSpent < 0
              ? 'More has gone out than has come in. Money that was in the accounts before this ledger started does not appear here.'
              : 'What has come in, less what has gone out. Not a bank balance — nothing here knows what was in the accounts before this ledger started.'
          }
        >
          <Figure>{formatPaisa(Math.abs(notYetSpent))}</Figure>
        </Tile>

        <Tile
          label="Paid out this month"
          tone="text-brass"
          // His `Across 47 entries`, which is what tells him whether a heavy month was one cheque or forty.
          beneath={
            what.thisMonth.entries === 0
              ? 'Nothing has gone out this month.'
              : `Across ${String(what.thisMonth.entries)} ${what.thisMonth.entries === 1 ? 'entry' : 'entries'}`
          }
        >
          <Figure>{formatPaisa(what.thisMonth.paidOutPaisa)}</Figure>
        </Tile>

        <Tile
          label="Outstanding payables"
          // His caption is `Owed to 4 suppliers`. Not everyone owed is a supplier -- a labour contractor is not -- so it says people, which is what the ledger calls them and what the nav calls them.

          // The advance is never netted into the figure above it and never left off: an advance held by the tile man is not money available to pay the steel man.
          beneath={
            <>
              {what.owed.people === 0
                ? 'Nobody is owed anything.'
                : `Owed to ${String(what.owed.people)} ${what.owed.people === 1 ? 'person' : 'people'}.`}{' '}
              {what.owed.advancedPaisa === 0
                ? 'Nobody is holding an advance.'
                : `${formatPaisa(what.owed.advancedPaisa)} is held in advance, which is not money to pay anybody with.`}
            </>
          }
        >
          <Figure>{formatPaisa(what.owed.payablePaisa)}</Figure>
        </Tile>

        <Tile
          label="Received this month"
          tone="text-green"
          // His own words, and they are the distinction the whole profit split turns on: what a client pays is the house earning, what a partner puts in is the house being funded, and one figure holding both reads as profit.
          beneath="Client payments and capital"
        >
          <Figure>{formatPaisa(what.thisMonth.receivedPaisa)}</Figure>
        </Tile>
      </dl>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <WhereItWent spending={what.whereItWent} month={what.thisMonth.month} />
        <InAndOut months={what.inAndOut} />
      </div>

      <TheSites houses={what.houses} />
    </div>
  )
}

// The screen he sees first and today, built as its own thing rather than as an empty version of the other one.
function NothingYet({ houses }: { houses: number }) {
  return (
    <div className="flex flex-col gap-4 py-6">
      <p className="text-foreground font-display text-2xl">Nothing has gone in yet.</p>
      <p className="text-muted-foreground max-w-prose">
        {houses === 0
          ? 'Start a house, and what it costs and what comes in against it collect here.'
          : `${houses === 1 ? 'One house is' : `${String(houses)} houses are`} down and nothing has been entered against ${houses === 1 ? 'it' : 'them'} yet. Put in a day of payments, or the money that has come in, and this fills itself.`}
      </p>

      <div className="flex flex-wrap gap-3">
        <Link to="/" className="bg-primary text-primary-foreground rounded-md px-5 py-3 font-medium">
          {houses === 0 ? 'Start a house' : 'Back to sites'}
        </Link>
        <Link to="/people" className="border-border text-foreground rounded-md border px-5 py-3 font-medium">
          Add people
        </Link>
      </div>
    </div>
  )
}

function Waiting() {
  return (
    <WhileWaiting what="Getting everything">
      {/* The shape of what is coming, so nothing jumps when it arrives: four tiles in the grid the tiles use, drawn as the card they are drawn as, then the two charts beside each other. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-40 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="border-border bg-card flex flex-col gap-5 rounded-xl border p-5 shadow-sm">
            <Skeleton className="h-4 w-44" />
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2, 3].map((bar) => (
                <div key={bar} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
