import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ComingIn } from '../components/moneyIn/ComingIn'

export const Route = createFileRoute('/sites/$siteId/coming-in')({ component: WhatCameIn })

function WhatCameIn() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const received = useQuery(api.moneyIn.queries.forSite, forSite)
  const people = useQuery(api.people.queries.list, {})
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const record = useMutation(api.moneyIn.mutations.record)
  const takeBack = useMutation(api.moneyIn.mutations.remove)

  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  return (
    <ComingIn
      siteName={site?.name ?? ''}
      // Handed over as they came: `undefined` is a read still in flight, `null` is an answer. Flattening them is what leaves a screen watching for something that is not coming.
      received={received}
      people={people}
      accounts={accounts}
      saving={saving}
      refusal={refusal}
      onTakeBack={async (moneyInId) => {
        // Looked up in the list it came from rather than cast, and waiting is not refused even here: `received ?? []` would say the receipt is gone when the read had simply not come back.
        if (received === undefined) {
          throw new ConvexError('What has come in is still loading. Try again in a moment.')
        }

        if (received === null) {
          throw new ConvexError('What has come in did not load. Open the house again.')
        }

        const one = received.find((each) => each._id === moneyInId)
        if (one === undefined) {
          throw new ConvexError('That money is not on this house.')
        }

        await takeBack({ ...forSite, moneyInId: one._id })
      }}
      onPutIn={async (receipt) => {
        setSaving(true)
        setRefusal(null)

        try {
          await record({
            ...forSite,
            day: receipt.day,
            amount: receipt.amount,
            fromId: receipt.fromId as Id<'people'>,
            why: receipt.why,
            method: receipt.method,
            reference: receipt.reference,
            bankAccountId: receipt.bankAccountId as Id<'bankAccounts'> | undefined,
            note: receipt.note,
          })

          return true
        } catch (thrown) {
          // The sentence the server refused with, which is written for him. Anything else is the app failing rather than him being wrong.
          setRefusal(thrown instanceof ConvexError ? String(thrown.data) : 'That did not go in. Try once more.')

          // Said rather than swallowed: the screen empties its boxes on a yes, and a refusal that came back as one takes the amount he is being asked about with it.
          return false
        } finally {
          setSaving(false)
        }
      }}
    />
  )
}
