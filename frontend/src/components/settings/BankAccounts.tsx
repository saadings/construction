import { useState } from 'react'
import { bankAccountLabel, lastFourOf } from '~shared/validation/bankAccount'
import { whatIsWrong } from '~shared/validation/primitives'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'
import { whatWentWrong } from '../form/whatWentWrong'
import { Form, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

// The accounts a cheque or transfer left. One could be added from the day sheet and taken off nowhere, so a mistyped account stayed in the picker for good.

export type AccountRow = { _id: string; label: string; lastFourDigits: string }

export function BankAccounts({
  accounts,
  onAdd,
  onTakeOff,
}: {
  accounts: Array<AccountRow> | null | undefined
  onAdd: (label: string, lastFourDigits: string) => Promise<void>
  onTakeOff: (bankAccountId: string) => Promise<void>
}) {
  return (
    // In a `Page` like every other screen a route draws. Without it this sat flush against the left edge of a phone, and the title is what the menu row that reaches it says rather than a second name for the same place.
    <Page title="Which account">
      <p className="text-muted-foreground max-w-prose text-sm">
        Only the last four figures are ever kept. The whole number never leaves this device.
      </p>

      {accounts === undefined ? (
        <WhileWaiting what="Getting the accounts">
          <div className="border-border divide-hairline flex flex-col divide-y rounded-md border">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center justify-between gap-3 px-4 py-3">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </WhileWaiting>
      ) : accounts === null ? (
        <p className="text-muted-foreground text-sm">The accounts did not come back. Sign out and in again.</p>
      ) : accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          None yet. Put one in and a cheque can say which account it left.
        </p>
      ) : (
        <ul
          aria-label="Accounts money leaves"
          className="border-border divide-hairline flex flex-col divide-y rounded-md border"
        >
          {accounts.map((account) => (
            <OneAccount key={account._id} account={account} onTakeOff={onTakeOff} />
          ))}
        </ul>
      )}

      <AddAnAccount onAdd={onAdd} />
    </Page>
  )
}

function OneAccount({
  account,
  onTakeOff,
}: {
  account: AccountRow
  onTakeOff: (bankAccountId: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
      <span className="text-foreground text-sm">{account.label}</span>
      <span className="flex items-baseline gap-4">
        {/* Drawn as it is stored. There is no whole number anywhere to mask. */}
        <span className="text-muted-foreground font-mono text-sm tabular-nums">••••{account.lastFourDigits}</span>
        <button
          type="button"
          onClick={() => {
            setSaving(true)
            setRefusal(null)
            void onTakeOff(account._id)
              .catch((thrown: unknown) => {
                setRefusal(whatWentWrong(thrown))
              })
              .finally(() => {
                setSaving(false)
              })
          }}
          className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline underline-offset-4"
        >
          {saving ? 'Taking it off…' : 'Take it off'}
        </button>
      </span>
      {refusal === null ? null : (
        <span role="alert" className="text-destructive w-full text-sm">
          {refusal}
        </span>
      )}
    </li>
  )
}

// The same form the day sheet offers, so an account put in here and one put in mid-payment are the same thing said the same way.
function AddAnAccount({ onAdd }: { onAdd: (label: string, lastFourDigits: string) => Promise<void> }) {
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [added, setAdded] = useState(0)

  async function add() {
    setSaving(true)
    setRefusal(null)

    try {
      // The whole number is read here and thrown away here. Only its last four digits are ever sent.
      await onAdd(label, lastFourOf.parse(number))
      setLabel('')
      setNumber('')
      setAdded((before) => before + 1)
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form className="gap-4" freshAfter={added}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="What you call it"
          hint="The bank, then its last four figures."
          problem={whatIsWrong(bankAccountLabel, label)}
        >
          <Line
            value={label}
            onChange={(event) => {
              setLabel(event.target.value)
            }}
            autoComplete="off"
            placeholder="Bank 0000"
            aria-label="What you call it"
          />
        </Field>

        <Field
          label="The account number"
          hint="Only the last four figures leave this device."
          problem={whatIsWrong(lastFourOf, number)}
        >
          <Line
            value={number}
            onChange={(event) => {
              setNumber(event.target.value)
            }}
            inputMode="numeric"
            autoComplete="off"
            aria-label="The account number"
          />
        </Field>
      </div>

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div>
        <Button onClick={add} busy={saving} className="py-2 text-sm">
          Put the account in
        </Button>
      </div>
    </Form>
  )
}
