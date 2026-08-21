import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { whatWentWrong } from '../form/whatWentWrong'
import { ComingIn } from './ComingIn'

// Money arriving against one house: the reading, the sending, and taking one back out.

// Written once for the same reason `ADayOfPayments` is. There are two ways in and one screen -- from a house, where the address decides which house it is, and from the ledger, where he picks. The seventy lines under it were the seventy lines twice, and one of the two would have been the one that quietly stopped refusing a receipt properly.
export function AReceiptComingIn({
  siteId,
  title,
  pickSite,
}: {
  siteId: string
  title?: string
  /** The house picker, where the address did not already decide which house this is. */
  pickSite?: ReactNode
}) {
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const received = useQuery(api.moneyIn.queries.forSite, forSite)
  const people = useQuery(api.people.queries.list, {})
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const record = useMutation(api.moneyIn.mutations.record)
  const takeBack = useMutation(api.moneyIn.mutations.remove)
  const addAccount = useMutation(api.bankAccounts.mutations.add)

  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  return (
    <ComingIn
      siteName={site?.name ?? ''}
      title={title}
      pickSite={pickSite}
      // Handed over as they came: `undefined` is a read still in flight, `null` is an answer. Flattening them is what leaves a screen watching for something that is not coming.
      received={received}
      people={people}
      accounts={accounts}
      saving={saving}
      refusal={refusal}
      onAddAccount={async (label, lastFourDigits) => await addAccount({ label, lastFourDigits })}
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
      onPutIn={async (arrivals) => {
        setSaving(true)
        setRefusal(null)

        try {
          // One call for however many ways it came. Sent one at a time, a refused half would leave the other in the ledger -- a 300,000 arrival sitting as 200,000, indistinguishable from a 200,000 he really had.
          await record({
            ...forSite,
            arrivals: arrivals.map((receipt) => ({
              day: receipt.day,
              amount: receipt.amount,
              fromId: receipt.fromId as Id<'people'>,
              why: receipt.why,
              method: receipt.method,
              reference: receipt.reference,
              bankAccountId: receipt.bankAccountId as Id<'bankAccounts'> | undefined,
              note: receipt.note,
            })),
          })

          return true
        } catch (thrown) {
          // The sentence the server refused with, which is written for him. Anything else is the app failing rather than him being wrong.
          setRefusal(whatWentWrong(thrown))

          // Said rather than swallowed: the screen empties its boxes on a yes, and a refusal that came back as one takes the amount he is being asked about with it.
          return false
        } finally {
          setSaving(false)
        }
      }}
    />
  )
}
