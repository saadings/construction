import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'

import { api } from '../../../convex/_generated/api'
import { BankAccounts } from '../components/settings/BankAccounts'

export const Route = createFileRoute('/more/which-account')({ component: WhichAccount })

// The accounts a cheque or transfer says it left, named after the day sheet's own label.
function WhichAccount() {
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
