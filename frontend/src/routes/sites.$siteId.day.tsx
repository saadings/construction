import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { todayOnThisDevice } from '~shared/calendarDate'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { DaySheet } from '../components/daySheet/DaySheet'
import type { Draft } from '../components/daySheet/sitting'
import { asAnEntry } from '../components/daySheet/sitting'

export const Route = createFileRoute('/sites/$siteId/day')({ component: ADayOnSite })

function ADayOnSite() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const trades = useQuery(api.trades.queries.list, {})
  const people = useQuery(api.people.queries.list, {})
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const record = useMutation(api.payments.mutations.record)
  const addAccount = useMutation(api.bankAccounts.mutations.add)
  const router = useRouter()

  const [day, setDay] = useState(todayOnThisDevice)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  // Undefined means the answer has not arrived. Null means it arrived and was refused, which is the same screen whichever of them says it.
  if (site === undefined || trades === undefined || people === undefined || accounts === undefined) {
    return <Waiting />
  }

  if (site === null || trades === null || people === null || accounts === null) {
    return <NotYours />
  }

  async function putThemIn(drafts: Array<Draft>) {
    setSaving(true)
    setRefusal(null)

    try {
      await record({ ...forSite, entries: drafts.map((draft) => asAnEntry(draft, day)) })
      // Back to the site itself, not the list: the number he has just moved is that house's, and watching it move is the whole reason the day was entered.
      await router.navigate({ to: '/sites/$siteId', params: { siteId } })
    } catch (thrown) {
      setRefusal(thrown instanceof ConvexError ? String(thrown.data) : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DaySheet
      siteName={site.name}
      day={day}
      onChangeDay={setDay}
      trades={trades}
      people={people}
      accounts={accounts}
      saving={saving}
      refusal={refusal}
      onPutIn={putThemIn}
      onAddAccount={async (label, lastFourDigits) => await addAccount({ label, lastFourDigits })}
    />
  )
}

function Waiting() {
  return (
    <main className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center p-6">
      <p>Getting the site…</p>
    </main>
  )
}

// One screen for both answers, because whether the house is gone or was never yours is exactly what the server refuses to leak, and saying "not yours" alone would undo that by admitting it is there.
function NotYours() {
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-foreground font-display text-2xl">Nothing to open here.</p>
      <p className="text-muted-foreground max-w-xs">
        This house may have been put away, or you may not be on it. Ask Nauman.
      </p>
      <Link to="/" className="text-primary pt-2 font-medium">
        Back to your sites
      </Link>
    </main>
  )
}
