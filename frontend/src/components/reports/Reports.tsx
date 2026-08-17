import { Link } from '@tanstack/react-router'
import { BarChart3, Building2, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatPaisa } from '~shared/money'

import { NotKnownHere } from '../shell/NotKnownHere'
import { Figure, Page } from '../shell/Page'
import { Panel } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

// The questions the books get asked, each one opening the screen that answers it. A way in rather than a screen of its own: every figure on a card is read off the same query as the screen behind it, so a card and the screen it opens cannot disagree about the figure he is looking at twice.

// Four were drawn and one is not here. **Cost per house against its estimate** is the report he would want most, and nothing in this ledger holds what a house was expected to cost -- there is a contract with a client, which is what a house is sold for, and no estimate of what it takes to build. A card promising that answer and opening a screen that cannot give it is worse than no card.

export type WhatTheBooksAnswer = {
  /** How much has gone out and over how many trades, read off the dashboard's own reading rather than worked out again here. */
  spending: { trades: number; goneOutPaisa: number; ownMoneyPaisa: number }
  /** Who is owed and how much, read off the owed screen's, so the count on the card is the count on the screen. */
  owed: { people: number; payablePaisa: number }
}

/** What the screen is, said where the drawing says it. */
const WHAT_THIS_IS = 'The questions the books get asked. Each one opens the rows behind it.'

export function Reports({ what }: { what: WhatTheBooksAnswer | null }) {
  // The ledger has answered and does not know this sign-in. Every card here opens a screen that would refuse the same way, so it offers none of them.
  if (what === null) {
    return (
      <Page title="Reports" said={WHAT_THIS_IS}>
        <NotKnownHere />
      </Page>
    )
  }

  return (
    <Page title="Reports" said={WHAT_THIS_IS}>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Report
          to="/dashboard"
          icon={<BarChart3 className="text-brass size-4" aria-hidden />}
          name="Spending by category"
          what="Where the money went, by trade, across every house at once."
          figure={
            <>
              {what.spending.trades} trades · <Figure>{formatPaisa(what.spending.goneOutPaisa)}</Figure> spent
            </>
          }
        />

        <Report
          to="/owed"
          icon={<Wallet className="text-brass size-4" aria-hidden />}
          name="Who is owed what"
          // The drawing says "with its age". A bill has no day it falls due, and money goes out on account rather than against bill seven, so how long a balance has been standing is not a thing this ledger can answer yet. A card is not the place to introduce a figure the screen it opens does not show.
          what="Every open balance in one list, so nothing sits unpaid because it was forgotten."
          figure={
            <>
              {what.owed.people} people · <Figure>{formatPaisa(what.owed.payablePaisa)}</Figure> outstanding
            </>
          }
        />

        <Report
          to="/"
          icon={<Building2 className="text-brass size-4" aria-hidden />}
          name="Partner positions"
          // The drawing points this card at the receipts screen, which is money arriving rather than what anybody's share came to. Shares are agreed on the house they are for, so it opens the houses instead -- the one place from which every partner's position is one step away.
          what="What each partner has put in against his share. Agreed on the house it is for, so this opens the houses."
          figure={
            <>
              <Figure>{formatPaisa(what.spending.ownMoneyPaisa)}</Figure> put in by partners
            </>
          }
        />
      </ul>
    </Page>
  )
}

// A link and not a button: it goes somewhere, so a middle click or a long press has to open it in its own tab the way every other way through this app can.
function Report({
  to,
  icon,
  name,
  what,
  figure,
}: {
  to: string
  icon: ReactNode
  name: string
  what: string
  /** The live figure at the foot of the card, off the same reading as the screen it opens. */
  figure: ReactNode
}) {
  return (
    <li className="flex">
      <Panel className="hover:border-brass flex w-full flex-col transition-colors">
        <Link to={to} className="flex h-full flex-col gap-3 p-5">
          <span className="flex items-center gap-2.5">
            {icon}
            <span className="text-foreground font-semibold">{name}</span>
          </span>

          <span className="text-muted-foreground text-[0.8125rem]">{what}</span>

          <span className="text-brass mt-auto pt-1 text-[0.8125rem]">{figure}</span>
        </Link>
      </Panel>
    </li>
  )
}

// The shape of what is coming: three cards of the same height, in the same two columns, so nothing moves when the figures land.

// Drawn by the screen that decides it is still waiting rather than by this one. Two readings feed these cards, and which of them has not arrived is the route's question -- so the route holds the shape as well, and neither half decides half of it.
export function ReportsWaiting() {
  return (
    <Page title="Reports" said={WHAT_THIS_IS}>
      <WhileWaiting what="Getting the figures behind each one">
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2].map((card) => (
            <li key={card} className="flex">
              <Panel className="flex w-full flex-col gap-3 p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full max-w-[26rem]" />
                <Skeleton className="mt-auto h-4 w-44 max-w-full" />
              </Panel>
            </li>
          ))}
        </ul>
      </WhileWaiting>
    </Page>
  )
}
