import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { AgreeShares } from '../components/partners/AgreeShares'

export const Route = createFileRoute('/sites/$siteId/shares')({ component: WhoTakesWhat })

function WhoTakesWhat() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const what = useQuery(api.partners.queries.positions, forSite)
  const everybody = useQuery(api.people.queries.list, {})
  const agree = useMutation(api.profitShares.mutations.agree)
  const followTheMoney = useMutation(api.profitShares.mutations.followTheMoney)

  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  // The sentence the server refused with, which is written for him. Anything else is the app failing rather than him being wrong.
  async function through(sending: Promise<unknown>): Promise<boolean> {
    setSaving(true)
    setRefusal(null)

    try {
      await sending

      return true
    } catch (thrown) {
      setRefusal(thrown instanceof ConvexError ? String(thrown.data) : 'That did not go in. Try once more.')

      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <AgreeShares
      siteName={site?.name ?? ''}
      // Handed over as it came, whole. Slicing `positions` out of it here would fold a house that is not there into a reading still on its way, which is the permanent spinner all over again.
      what={what}
      everybody={everybody}
      saving={saving}
      refusal={refusal}
      onAgree={(agreedOn, shares) => through(agree({ ...forSite, agreedOn, shares: asIds(shares) }))}
      onFollowTheMoney={() => through(followTheMoney(forSite))}
    />
  )
}

// A screen holds a person as plain text, because that is what a picker hands back. The ids came from the reading above, so this is naming what they already are rather than asserting anything about them.
function asIds(shares: Array<{ personId: string; share: string }>): Array<{ personId: Id<'people'>; share: string }> {
  return shares.map((one) => ({ personId: one.personId as Id<'people'>, share: one.share }))
}
