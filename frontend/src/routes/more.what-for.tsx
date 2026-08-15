import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'

import { api } from '../../../convex/_generated/api'
import { Trades } from '../components/settings/Trades'

export const Route = createFileRoute('/more/what-for')({ component: WhatFor })

// The list a day sheet picks from, named after the field that picks from it.
function WhatFor() {
  const trades = useQuery(api.trades.queries.list, {})
  const add = useMutation(api.trades.mutations.add)
  const edit = useMutation(api.trades.mutations.edit)
  const hide = useMutation(api.trades.mutations.hide)

  // Looked up in the list it came from rather than cast: the row is in hand here, and a cast would be a promise about a string. Waiting and refused are two different answers even here -- `?? []` would say the trade is gone when the read simply had not come back.
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
