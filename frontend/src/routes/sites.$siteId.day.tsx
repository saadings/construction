import { createFileRoute } from '@tanstack/react-router'
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

  const [day, setDay] = useState(todayOnThisDevice)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  // Undefined means the answer has not arrived; null means it arrived and this site is not one of his.
  if (site === undefined || trades === undefined || people === undefined || accounts === undefined) {
    return <Waiting />
  }

  if (site === null) {
    return <NotYours />
  }

  async function putThemIn(drafts: Array<Draft>) {
    setSaving(true)
    setRefusal(null)

    try {
      await record({ ...forSite, entries: drafts.map((draft) => asAnEntry(draft, day)) })
      // Everything went in together, so the sitting starts again empty rather than showing what is already saved.
      window.location.assign(`/sites/${siteId}`)
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

function NotYours() {
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-foreground font-display text-2xl">This site is not one of yours.</p>
      <p className="text-muted-foreground">Ask Nauman to put you on it.</p>
    </main>
  )
}
