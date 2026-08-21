import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { ADayOfPayments } from '../components/daySheet/ADayOfPayments'
import { NothingToOpen } from '../components/shell/NothingToOpen'
import { Skeleton, WhileWaiting } from '../components/shell/Skeleton'
import { PickASite } from '../components/sites/PickASite'

export const Route = createFileRoute('/daybook')({ component: TheDaybook })

// His second rail row: the day's payments, entered from anywhere rather than from inside a house.

// The house is chosen on the screen, which is the whole difference from `/sites/$siteId/day`. Somebody standing on a site with a cheque book is not navigating to a house first -- he presses `Daybook` and picks.
function TheDaybook() {
  const sites = useQuery(api.sites.queries.all, {})
  const router = useRouter()

  // Nothing chosen yet, rather than a guess. Which house it opens on is decided once the list has arrived, because a default picked before there is a list is a default of nothing.
  const [chosen, setChosen] = useState<string | null>(null)

  if (sites === undefined) {
    return <Waiting />
  }

  if (sites === null || sites.length === 0) {
    return <NoHouses refused={sites === null} />
  }

  // The first house until he says otherwise. It is a guess, and it is the only one available: nothing here knows which house he is standing on, and a screen that opens on no house at all asks a question before it has drawn anything.
  const siteId = chosen ?? sites[0]._id

  return (
    <ADayOfPayments
      siteId={siteId}
      pickSite={<PickASite sites={sites} chosen={siteId} onPick={setChosen} />}
      // Back to the daybook rather than into a house. He came here to enter a day and the next thing he does is enter another one, which is what going somewhere else would interrupt.
      whereToAfterwards={async () => {
        await router.navigate({ to: '/daybook' })
      }}
    />
  )
}

function Waiting() {
  return (
    <main className="bg-background min-h-dvh p-5 sm:p-7">
      <WhileWaiting what="Getting the houses">
        <Skeleton className="h-8 w-52 max-w-full" />
        <Skeleton className="h-11 w-44 max-w-full" />
      </WhileWaiting>
    </main>
  )
}

// Two answers with one screen between them, and they are not the same sentence: a ledger with no houses in it is his first day, and a reading that was refused is something wrong at our end.
function NoHouses({ refused }: { refused: boolean }) {
  return refused ? (
    <NothingToOpen />
  ) : (
    <NothingToOpen
      said="Nothing to enter against yet."
      because="A day of payments goes against a house, and there is no house on the books. Start one and this is where its spending goes in."
      wayOut="Start a house"
    />
  )
}
