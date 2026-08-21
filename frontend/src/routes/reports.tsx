import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { todayOnThisDevice } from '~shared/calendarDate'

import { api } from '../../../convex/_generated/api'
import type { WhatTheBooksAnswer } from '../components/reports/Reports'
import { Reports, ReportsWaiting } from '../components/reports/Reports'

export const Route = createFileRoute('/reports')({ component: TheQuestionsTheBooksAnswer })

// Two readings the app already has rather than a third that adds them up again. A card carrying a figure worked out beside the screen it opens is exactly how a card and a screen come to disagree, and this way they are the same arithmetic by construction.
function TheQuestionsTheBooksAnswer() {
  const happening = useQuery(api.dashboard.queries.whatIsHappening, { today: todayOnThisDevice() })
  const owed = useQuery(api.owed.queries.position, {})

  const what = whatTheBooksAnswer(happening, owed)

  // The shape while it waits is drawn here because the waiting is decided here: two readings feed one set of cards, and half of them arriving is still nothing to look at.
  return what === undefined ? <ReportsWaiting /> : <Reports what={what} />
}

/** The two readings folded into what the cards need, keeping the three states apart: still coming, refused, and answered. */
export function whatTheBooksAnswer(
  happening:
    | {
        goneOutPaisa: number
        comeIn: { ownMoneyPaisa: number }
        whereItWent: Array<unknown>
        thisMonth: { paidOutPaisa: number }
        houses: Array<{ goneOutPaisa: number }>
      }
    | null
    | undefined,
  owed: { everyone: Array<{ outstandingPaisa: number }>; payablePaisa: number } | null | undefined
): WhatTheBooksAnswer | null | undefined {
  // Either one still in flight is the screen still waiting. Drawing half the figures and pulsing the rest would move the cards under a thumb already reaching for one.
  if (happening === undefined || owed === undefined) return undefined

  // Either one refused is the ledger not knowing this sign-in, which is the same answer from both and the same answer the screens behind these cards give.
  if (happening === null || owed === null) return null

  return {
    // Counted off the same list the houses screen is drawn from, and summed from the houses rather than taken from the ledger total -- so the figure on the card is the figure the screen behind it adds up to.
    houses: {
      count: happening.houses.length,
      goneOutPaisa: happening.houses.reduce((total, house) => total + house.goneOutPaisa, 0),
    },
    // Both figures this month, because `whereItWent` is. It read `{this month's trades} trades · {all time spent}` -- one sentence holding two different spans of time, which is the same defect as a tile echoing a row and reads as a working card.
    spending: {
      trades: happening.whereItWent.length,
      thisMonthPaisa: happening.thisMonth.paidOutPaisa,
      ownMoneyPaisa: happening.comeIn.ownMoneyPaisa,
    },
    owed: {
      // Who is actually owed something. Somebody holding an advance is on the owed screen and is not one of the people owed, so counting the list would say four where the screen says three.
      people: owed.everyone.filter((person) => person.outstandingPaisa > 0).length,
      payablePaisa: owed.payablePaisa,
    },
  }
}
