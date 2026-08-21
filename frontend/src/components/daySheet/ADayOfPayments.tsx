import { useMutation, useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { todayOnThisDevice } from '~shared/calendarDate'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { whatWentWrong } from '../form/whatWentWrong'
import { NothingToOpen } from '../shell/NothingToOpen'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { DaySheet } from './DaySheet'
import type { Draft } from './sitting'
import { asEntries } from './sitting'
import { whereASittingIsKept } from './theSittingKept'

// A day of payments against one house: the reading, the sending, and what to do when either is refused.

// Written once because there are two ways in and one screen. `/sites/$siteId/daybook` reaches it from a house, with the house fixed by the address; `/daybook` is his own second rail row and reaches it from anywhere, with the house chosen on the screen. The forty lines of wiring underneath were the same forty lines twice, which is how the two come to disagree about what a refusal says or which day the sheet opens on.
export function ADayOfPayments({
  siteId,
  day: dayFromAbove,
  onChangeDay: dayChangedAbove,
  pickSite,
  whereToAfterwards,
  paying,
  onPayingTaken,
}: {
  siteId: string
  // Which day, when something above needs to move it. The daybook does: opening a sitting from the waiting list has to move the house and the day together, and a day held down here could only be told about one of them.

  // Absent everywhere else, and then this holds its own -- because a screen reached at a house is a screen opened on today, and threading that through a route to say `today` is a prop that says nothing.
  day?: string | null
  onChangeDay?: (day: string) => void
  /** The house picker, drawn in the sheet's own header. Absent where the address already decided which house this is. */
  pickSite?: ReactNode
  /** Where to go once a sitting is in. From a house it is that house, because the figure he has just moved is that house's and watching it move is the whole reason the day was entered. */
  whereToAfterwards: (siteId: string) => Promise<void>
  /** Somebody a link already knew was owed, to open the sheet on. Sent by `Pay` from the payables rail; absent from the daybook, which is reached without anybody in mind. */
  paying?: string
  onPayingTaken?: () => void
}) {
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const trades = useQuery(api.trades.queries.list, {})
  const people = useQuery(api.people.queries.list, {})
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const record = useMutation(api.payments.mutations.record)
  const addAccount = useMutation(api.bankAccounts.mutations.add)
  const addTrade = useMutation(api.trades.mutations.add)

  // Always called, and then deferred to: a hook behind a condition is a hook that runs on some renders and not others.
  const [dayHere, setDayHere] = useState(todayOnThisDevice)

  const day = dayFromAbove ?? dayHere
  const setDay = dayChangedAbove ?? setDayHere

  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  // Undefined means the answer has not arrived. Null means it arrived and was refused, which is the same screen whichever of them says it.
  if (site === undefined || trades === undefined || people === undefined || accounts === undefined) {
    return <Waiting />
  }

  if (site === null || trades === null || people === null || accounts === null) {
    return <NothingToOpen />
  }

  async function putThemIn(drafts: Array<Draft>): Promise<boolean> {
    setSaving(true)
    setRefusal(null)

    try {
      // One line can be more than one row: a payment settled by cheque and cash is two entries sharing the trade, the person and the day. They go in one call, so a refused half cannot leave the other in the ledger.
      await record({ ...forSite, entries: drafts.flatMap((draft) => asEntries(draft, day)) })
      await whereToAfterwards(siteId)

      // Said back to the sheet, which forgets what it was keeping on the device only once it is really in the ledger.
      return true
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))

      return false
    } finally {
      setSaving(false)
    }
  }

  // Where this sitting is kept while it is typed: this house, this day.
  const keptUnder = whereASittingIsKept(siteId, day)

  return (
    <DaySheet
      // Remounted when the house or the day changes, and this one line is load-bearing.

      // `DaySheet` reads what was kept **once**, on mount, and writes on every change under whatever key it currently has. So a key that changed under a mounted sheet wrote the rows already typed to the *new* key and never read the new key's own sitting -- one house's payments landing under another house's, silently, on money.

      // Reachable on `main` through the date picker and rarely hit, because a date is corrected by one step now and then. His daybook puts a house picker in the sticky header, which turns that into the ordinary way to use the screen.

      // What falls out is the right behaviour rather than the lesser evil: every house and day keeps its own sitting, and switching between them restores each. `Form` takes a `key` for the same reason one level down.
      key={keptUnder}
      siteName={site.name}
      pickSite={pickSite}
      day={day}
      onChangeDay={setDay}
      trades={trades}
      people={people}
      accounts={accounts}
      saving={saving}
      refusal={refusal}
      paying={paying}
      onPayingTaken={onPayingTaken}
      onPutIn={putThemIn}
      // Another house never shows this one's half-typed payment, and yesterday's sheet never shows today's.
      keptUnder={keptUnder}
      onAddAccount={async (label, lastFourDigits) => await addAccount({ label, lastFourDigits })}
      onAddTrade={async (trade) => await addTrade(trade)}
    />
  )
}

// The sheet's own shape: a heading, the day, and the first payment's questions. It is what is coming, so nothing jumps when it does.
function Waiting() {
  return (
    <main className="bg-background min-h-dvh p-5 sm:p-7">
      <WhileWaiting what="Getting the day sheet">
        <Skeleton className="h-8 w-52 max-w-full" />
        <Skeleton className="h-11 w-44 max-w-full" />

        <div className="border-border mt-2 flex flex-col gap-5 rounded-md border p-4">
          {[0, 1, 2].map((question) => (
            <div key={question} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full max-w-md" />
            </div>
          ))}
        </div>
      </WhileWaiting>
    </main>
  )
}
