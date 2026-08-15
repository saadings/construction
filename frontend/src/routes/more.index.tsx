import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { whatItLooksLike } from '../components/settings/HowItLooks'
import type { WhereToGo } from '../components/settings/TheMenu'
import { TheCountWaiting, TheMenu } from '../components/settings/TheMenu'
import { useHowItLooks } from '../lib/theme'

export const Route = createFileRoute('/more/')({ component: More })

// How many, or what it is set to. A menu that lists only names has to be opened five times to answer one question, and four of these five answer theirs in a word.

// A list still coming hands back the shape of a figure rather than a nought: they are different answers, and a nought is the one that reads as a fact. A list that refused says nothing at all, because the screen behind it will say why.
function howMany(rows: Array<unknown> | null | undefined, none: string) {
  if (rows === undefined) return <TheCountWaiting />
  if (rows === null) return ''

  return rows.length === 0 ? none : String(rows.length)
}

function More() {
  const trades = useQuery(api.trades.queries.list, {})
  const accounts = useQuery(api.bankAccounts.queries.list, {})
  const { chosen } = useHowItLooks()

  const places: Array<WhereToGo> = [
    {
      to: '/more/what-for',
      name: 'What for',
      what: 'The list a day sheet picks from — bricks, steel, plot, and anything you add.',
      now: howMany(trades, 'none yet'),
    },
    {
      to: '/more/which-account',
      name: 'Which account',
      what: 'The accounts a cheque or transfer says it left. Only the last four figures are kept.',
      now: howMany(accounts, 'none yet'),
    },
    {
      to: '/more/who-can-sign-in',
      name: 'Who can sign in',
      what: 'Invite somebody. Nobody can sign in without one.',
      now: '',
    },
    {
      to: '/more/how-it-looks',
      name: 'How it looks',
      what: 'Light, dark, or whatever the phone is doing.',
      now: whatItLooksLike(chosen),
    },
  ]

  return <TheMenu places={places} />
}
