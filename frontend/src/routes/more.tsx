import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import type { Invited } from '../components/invites/WhoCanSignIn'
import { WhoCanSignIn } from '../components/invites/WhoCanSignIn'
import { BankAccounts } from '../components/settings/BankAccounts'
import { Trades } from '../components/settings/Trades'
import { YourSignIn } from '../components/settings/YourSignIn'
import { Form, Page } from '../components/shell/Page'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import type { HowItLooks } from '../lib/theme'
import { useHowItLooks } from '../lib/theme'

export const Route = createFileRoute('/more')({ component: More })

const LOOKS: Array<{ value: HowItLooks; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'follow', label: 'Follow the phone' },
]

function More() {
  const { chosen, choose } = useHowItLooks()

  return (
    <Page title="More">
      <Form>
        <YourSignIn />

        <Invites />

        <WhatItIsSpentOn />
        <WhereItLeavesFrom />

        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-base font-medium">How it looks</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Following the phone is usually right. Change it when you are outside and the screen is hard to read.
          </p>

          <ToggleGroup
            type="single"
            value={chosen}
            // A segmented control hands back an empty string when the pressed one is pressed again, and that is not a fourth way for the app to look.
            onValueChange={(picked) => {
              const known = LOOKS.find((look) => look.value === picked)
              if (known !== undefined) {
                choose(known.value)
              }
            }}
            variant="outline"
            aria-label="How it looks"
            className="w-full max-w-md"
          >
            {LOOKS.map((look) => (
              <ToggleGroupItem key={look.value} value={look.value} className="flex-1">
                {look.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      </Form>
    </Page>
  )
}

// What money is spent on, and the accounts it leaves. Nauman asked for both by name: "Will there be system settings where we are able to add multiple things like what for, who was paid (contractor), etc etc?"
function WhatItIsSpentOn() {
  const trades = useQuery(api.trades.queries.list, {})
  const add = useMutation(api.trades.mutations.add)
  const edit = useMutation(api.trades.mutations.edit)
  const hide = useMutation(api.trades.mutations.hide)

  // Looked up in the list it came from rather than cast: the row is in hand here, and a cast would be a promise about a string. Waiting and refused are two different answers even here, where nobody sees the list -- `?? []` would tell him the trade is gone when the read simply had not come back.
  const which = (tradeId: string) => {
    if (trades === undefined) {
      throw new ConvexError('The list is still coming. Try again in a moment.')
    }

    if (trades === null) {
      throw new ConvexError('The list did not come back. Sign out and in again.')
    }

    const trade = trades.find((one) => one._id === tradeId)
    if (trade === undefined) {
      throw new ConvexError('That is not on the list any more.')
    }

    return trade._id
  }

  return (
    <Trades
      trades={trades}
      onAdd={async (trade) => {
        await add(trade)
      }}
      onEdit={async (tradeId, trade) => {
        await edit({ tradeId: which(tradeId), ...trade })
      }}
      onTakeOff={async (tradeId) => {
        await hide({ tradeId: which(tradeId) })
      }}
    />
  )
}

function WhereItLeavesFrom() {
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const add = useMutation(api.bankAccounts.mutations.add)
  const hide = useMutation(api.bankAccounts.mutations.hide)

  return (
    <BankAccounts
      accounts={accounts}
      onAdd={async (label, lastFourDigits) => {
        await add({ label, lastFourDigits })
      }}
      onTakeOff={async (bankAccountId) => {
        if (accounts === undefined) {
          throw new ConvexError('The accounts are still coming. Try again in a moment.')
        }

        if (accounts === null) {
          throw new ConvexError('The accounts did not come back. Sign out and in again.')
        }

        const account = accounts.find((one) => one._id === bankAccountId)
        if (account === undefined) {
          throw new ConvexError('That account is not on the list any more.')
        }

        await hide({ bankAccountId: account._id })
      }}
    />
  )
}

// The list comes from Clerk rather than from a table of ours, so it is asked for rather than watched: there is nothing here to keep in step with theirs.
function Invites() {
  const whoIsWaiting = useAction(api.invites.actions.whoIsWaiting)
  const invite = useAction(api.invites.actions.invite)
  const takeOff = useAction(api.invites.actions.takeOff)

  const [waiting, setWaiting] = useState<Array<Invited> | null>(null)

  const refresh = useCallback(async () => {
    setWaiting(await whoIsWaiting({}))
  }, [whoIsWaiting])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <WhoCanSignIn
      waiting={waiting}
      onInvite={async (email) => {
        await invite({ email })
        await refresh()
      }}
      onTakeOff={async (id) => {
        await takeOff({ id })
        await refresh()
      }}
    />
  )
}
