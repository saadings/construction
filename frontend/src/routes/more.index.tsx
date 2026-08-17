import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { whatItLooksLike } from '../components/settings/HowItLooks'
import { TheSettings } from '../components/settings/TheSettings'
import { useHowItLooks } from '../lib/theme'

export const Route = createFileRoute('/more/')({ component: More })

// The lists themselves rather than how many of them there are. A count answers *is there anything on it*; the card answers *is the one I am looking for on it*, which is the question that had somebody opening four screens.

// Handed over as they came. `undefined` is a reading still in flight and `null` is the ledger saying it has never seen this sign-in -- the card keeps them apart, because a refusal drawn as a wait is a card that pulses forever.
function More() {
  const trades = useQuery(api.trades.queries.list, {})
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const { chosen } = useHowItLooks()

  return <TheSettings what={{ trades, accounts, looksLike: whatItLooksLike(chosen) }} />
}
