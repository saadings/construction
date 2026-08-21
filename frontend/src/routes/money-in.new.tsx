import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { AReceiptComingIn } from '../components/moneyIn/AReceiptComingIn'
import { NothingToOpen } from '../components/shell/NothingToOpen'
import { Skeleton, WhileWaiting } from '../components/shell/Skeleton'
import { PickASite } from '../components/sites/PickASite'

export const Route = createFileRoute('/money-in/new')({ component: RecordAReceipt })

// `Record a receipt`, his own screen and his own words for it: money arriving, with the house chosen here rather than carried in the address.

// It exists because the dialog behind `New entry` offers two directions, and the second one had nowhere to land. `Receipts` is a list you cannot record on, and a chooser whose second option is worse than not choosing teaches somebody not to use it.
function RecordAReceipt() {
  const sites = useQuery(api.sites.queries.all, {})

  // Nothing chosen yet, rather than a guess. Which house it opens on is decided once the list has arrived, because a default picked before there is a list is a default of nothing.
  const [chosen, setChosen] = useState<string | null>(null)

  if (sites === undefined) {
    return <Waiting />
  }

  if (sites === null || sites.length === 0) {
    return sites === null ? (
      <NothingToOpen />
    ) : (
      <NothingToOpen
        said="Nothing to record it against yet."
        because="Money arriving goes against a house, and there is no house on the books. Start one and this is where what it takes in goes."
        wayOut="Start a house"
      />
    )
  }

  const siteId = chosen ?? sites[0]._id

  return (
    <AReceiptComingIn
      siteId={siteId}
      // His own title for this screen. The house's own version of it is still called `Invested`, which is one of the words with him -- and whatever he answers moves both, plus the dashboard tile and `Reports`.
      title="Record a receipt"
      pickSite={<PickASite sites={sites} chosen={siteId} onPick={setChosen} />}
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
