import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { whatWentWrong } from '../components/form/whatWentWrong'
import { AgreeShares } from '../components/partners/AgreeShares'
import { PayOut } from '../components/shares/PayOut'

export const Route = createFileRoute('/sites/$siteId/shares')({ component: WhoTakesWhat })

function WhoTakesWhat() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const what = useQuery(api.partners.queries.positions, forSite)
  const everybody = useQuery(api.people.queries.list, {})
  const paidOut = useQuery(api.profitPayouts.queries.forSite, forSite)
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const agree = useMutation(api.profitShares.mutations.agree)
  const followTheMoney = useMutation(api.profitShares.mutations.followTheMoney)
  const payOut = useMutation(api.profitPayouts.mutations.record)
  const takeBack = useMutation(api.profitPayouts.mutations.remove)
  const addAccount = useMutation(api.bankAccounts.mutations.add)

  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  // The sentence the server refused with, which is written for him. Anything else is the app failing rather than him being wrong.

  // This pair belongs to the shares form. What goes back to a partner keeps its own, because one refusal shared between two forms shows the sentence about a share under the button that records a cheque.
  async function through(sending: Promise<unknown>): Promise<boolean> {
    setSaving(true)
    setRefusal(null)

    try {
      await sending

      return true
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))

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
      beneath={(arrived) => (
        <PayOut
          // Who is on this house, worked out by the same reading the table above uses. Handed back by `AgreeShares` once it has arrived, so there is no reading still on its way to mistake for a house nobody has put money into.
          partners={arrived.positions.map((position) => ({ _id: position.personId, name: position.name }))}
          paidOut={paidOut}
          accounts={accounts}
          onPayOut={async (payouts) => {
            // One call for however many ways it went out, so a refused half cannot leave the other standing in the ledger.
            await payOut({
              ...forSite,
              payouts: payouts.map((payout) => ({
                personId: payout.personId as Id<'people'>,
                day: payout.day,
                amount: payout.amount,
                method: payout.method,
                reference: payout.reference,
                bankAccountId: payout.bankAccountId as Id<'bankAccounts'> | undefined,
                note: payout.note,
              })),
            })
          }}
          onAddAccount={async (label, lastFourDigits) => await addAccount({ label, lastFourDigits })}
          onTakeBack={async (payoutId) => {
            // Looked up in the list it came from rather than cast, and waiting is not refused: `paidOut ?? []` would say the payout is gone when the read had simply not come back.
            if (paidOut === undefined) {
              throw new ConvexError('What has gone back to them is still loading. Try again in a moment.')
            }

            if (paidOut === null) {
              throw new ConvexError('What has gone back to them did not load. Open the house again.')
            }

            const one = paidOut.find((each) => each._id === payoutId)
            if (one === undefined) {
              throw new ConvexError('That payment out is not on this house.')
            }

            await takeBack({ ...forSite, payoutId: one._id })
          }}
        />
      )}
    />
  )
}

// A screen holds a person as plain text, because that is what a picker hands back. The ids came from the reading above, so this is naming what they already are rather than asserting anything about them.

// A row with no id is somebody typed in who is not on the list yet, and it goes as a name: the server is the only place that can safely decide whether that name is already somebody, because only it can see everybody.
function asIds(
  shares: Array<{ personId?: string; newPerson?: string; share: string }>
): Array<{ personId?: Id<'people'>; newPerson?: string; share: string }> {
  return shares.map((one) => ({
    personId: one.personId === undefined ? undefined : (one.personId as Id<'people'>),
    newPerson: one.newPerson,
    share: one.share,
  }))
}
