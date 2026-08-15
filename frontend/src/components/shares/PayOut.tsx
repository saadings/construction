import { useState } from 'react'
import { formatPaisa, groupWhileTyping } from '~shared/money'
import type { HowPaid } from '~shared/validation/howMoneyMoved'
import { asksForBank, asksForChequeNumber } from '~shared/validation/howMoneyMoved'
import { SAY_PAYOUT } from '~shared/validation/profitShare'

import { Button } from '../form/Button'
import { Choices, Field, Line, Lines } from '../form/Field'
import type { Choice as Pickable } from '../form/Pick'
import { Pick, asChoices } from '../form/Pick'
import { Figure, Form } from '../shell/Page'
import { Skeleton, SkeletonLines, WhileWaiting } from '../shell/Skeleton'

// Money going back to a partner, written down after it has moved. The app pays nobody: somebody wrote a cheque or made a transfer, and this is where that gets recorded.

// `partners.queries.positions` counts what is here into a `paidPaisa` per partner. Until this screen existed there was nothing to count -- the two mutations behind it had no way in from anywhere, so `paidPaisa` was structurally zero and every partner read as owed the whole of his share, on the one screen that matters on the day a house sells.

// A partner is picked the way everything in this app is picked, so he is the row rather than his name: what the mutation wants is the id, and a control that hands back a string makes somebody find the id again -- which is a bug the first time two partners share a name.
export type Partner = Pickable
export type Account = { _id: string; label: string }

export type PaidOut = {
  _id: string
  day: string
  amountPaisa: number
  personName: string
  method: HowPaid
  reference?: string
  note?: string
}

export type NewPayout = {
  personId: string
  day: string
  amount: string
  method: HowPaid
  reference?: string
  bankAccountId?: string
  note?: string
}

const HOW: Array<{ value: HowPaid; label: string }> = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'payOrder', label: 'Pay order' },
]

const SAID: Record<HowPaid, string> = {
  cheque: 'Cheque',
  cash: 'Cash',
  transfer: 'Transfer',
  payOrder: 'Pay order',
}

// Its own refusal and its own busy, rather than the ones the shares form above it uses. Sharing them puts the sentence the server refused a share with underneath the payout button, where it is about neither thing.
export function PayOut({
  partners,
  paidOut,
  accounts,
  onPayOut,
  onTakeBack,
}: {
  // Who is on this house, which the reading above already worked out. Everybody in the address book would offer to pay somebody who has nothing to do with it.
  partners: Array<Partner>
  // As they came. `undefined` is a reading still on its way; `null` is an answer. Flattened to `[]` here, the account picker would say this partnership banks nowhere while the list was still arriving, and the way out of that is to type nothing and wonder.
  paidOut: Array<PaidOut> | null | undefined
  accounts: Array<Account> | null | undefined
  // Throws what the server refused with, which this turns into the sentence under the button. It is not the route's `through`, because that one belongs to the shares form.
  onPayOut: (payout: NewPayout) => Promise<void>
  onTakeBack: (payoutId: string) => Promise<void>
}) {
  return (
    <section className="flex flex-col gap-6 border-t pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-base font-medium">Money gone back to them</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          A cheque or a transfer that has already left. Writing it here is what makes it show under Paid.
        </p>
      </div>

      <Paying partners={partners} accounts={accounts} onPayOut={onPayOut} />

      <AlreadyOut paidOut={paidOut} onTakeBack={onTakeBack} />
    </section>
  )
}

function Paying({
  partners,
  accounts,
  onPayOut,
}: {
  partners: Array<Partner>
  accounts: Array<Account> | null | undefined
  onPayOut: (payout: NewPayout) => Promise<void>
}) {
  const [who, setWho] = useState<Partner | null>(null)
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<HowPaid>('cheque')
  const [reference, setReference] = useState('')
  const [account, setAccount] = useState<Pickable | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  // Counted rather than a flag, because the second payout has to empty the form as thoroughly as the first.
  const [goneOut, setGoneOut] = useState(0)

  // Asked from the same rules the server refuses by, in the server's own words, so the screen and the schema cannot drift into disagreeing.
  const wrongWho = who === null ? SAY_PAYOUT.who : null
  const wrongAmount = amount.trim() === '' ? SAY_PAYOUT.amount : null
  const wrongReference = asksForChequeNumber(method) && reference.trim() === '' ? SAY_PAYOUT.reference : null
  const wrongBank = asksForBank(method) && account === null ? SAY_PAYOUT.bank : null

  async function pay() {
    setSaving(true)
    setRefusal(null)

    try {
      await onPayOut({
        personId: who?._id ?? '',
        day,
        amount,
        method,
        reference: asksForChequeNumber(method) ? reference.trim() : undefined,
        bankAccountId: asksForBank(method) ? (account?._id ?? undefined) : undefined,
        note: note.trim() === '' ? undefined : note,
      })
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')

      // Left exactly as it was typed. The sentence above the button is about the figure still in the box, and emptying it leaves him reading a refusal against nothing.
      return
    } finally {
      setSaving(false)
    }

    setAmount('')
    setReference('')
    setNote('')
    setGoneOut((times) => times + 1)
  }

  if (partners.length === 0) {
    return (
      <p className="text-muted-foreground py-2 text-sm">
        Nobody has a share of this house yet. Put a partner’s money in, or agree the shares above, and you can record
        what goes back to them.
      </p>
    )
  }

  return (
    <Form freshAfter={goneOut}>
      {/* Only the partners on this house. Everybody in the address book would offer to pay a tile man his share of a profit. */}
      <Pick
        label="Who it went to"
        problem={wrongWho}
        placeholder="Pick one"
        chosen={who}
        choices={partners}
        onPick={setWho}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Which day">
          <Line value={day} onChange={(event) => setDay(event.target.value)} type="date" aria-label="Which day" />
        </Field>

        <Field label="How much" problem={wrongAmount}>
          <Line
            value={amount}
            onChange={(event) => setAmount(groupWhileTyping(event.target.value))}
            inputMode="decimal"
            aria-label="How much"
            placeholder="0"
          />
        </Field>
      </div>

      <Choices label="How it went">
        <div className="grid grid-cols-4 gap-2">
          {HOW.map((one) => (
            <Choice
              key={one.value}
              label={one.label}
              chosen={method === one.value}
              onChoose={() => setMethod(one.value)}
            />
          ))}
        </div>
      </Choices>

      {asksForChequeNumber(method) ? (
        <Field label="Cheque number" problem={wrongReference}>
          <Line value={reference} onChange={(event) => setReference(event.target.value)} aria-label="Cheque number" />
        </Field>
      ) : null}

      {asksForBank(method) ? (
        // Three different reasons there might be nothing to pick, and the first of them is not an empty list: a list still on its way says so, rather than showing the same nothing as a partnership that banks nowhere. `wrongBank` holds the button in all three, because nothing has been picked in any of them.
        <Pick
          label="Which account it left"
          problem={wrongBank}
          placeholder={whileThereIsNoList(accounts)}
          chosen={account}
          choices={asChoices(accounts ?? [])}
          onPick={setAccount}
        />
      ) : null}

      <Field label="Note">
        <Lines value={note} onChange={(event) => setNote(event.target.value)} aria-label="Note" />
      </Field>

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div>
        <Button onClick={pay} busy={saving}>
          Put it in
        </Button>
      </div>
    </Form>
  )
}

// What the account picker says before anything is in it, which is a different sentence for each of the three reasons there is nothing under it.
function whileThereIsNoList(accounts: Array<Account> | null | undefined): string {
  if (accounts === undefined) return 'Still getting the accounts…'
  if (accounts === null) return 'The accounts did not load'
  if (accounts.length === 0) return 'No accounts written down yet'

  return 'Pick one'
}

function Choice({ label, chosen, onChoose }: { label: string; chosen: boolean; onChoose: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onChoose}
      className={
        chosen
          ? 'border-primary bg-accent text-accent-foreground rounded-md border py-2.5 text-sm font-medium'
          : 'border-border text-muted-foreground rounded-md border py-2.5 text-sm'
      }
    >
      {label}
    </button>
  )
}

function AlreadyOut({
  paidOut,
  onTakeBack,
}: {
  paidOut: Array<PaidOut> | null | undefined
  onTakeBack: (payoutId: string) => Promise<void>
}) {
  if (paidOut === undefined) {
    return <AlreadyOutWaiting />
  }

  if (paidOut === null) {
    return null
  }

  if (paidOut.length === 0) {
    return <p className="text-muted-foreground py-2 text-sm">Nothing has gone back to anybody on this house yet.</p>
  }

  return (
    <ul className="divide-hairline flex flex-col divide-y">
      {paidOut.map((one) => (
        <OnePayout key={one._id} paidOut={one} onTakeBack={onTakeBack} />
      ))}
    </ul>
  )
}

// Taken back out, never erased, and signed by whoever did it. A partner's share vanishing without a signature is the exact case a disagreement about money turns on.
function OnePayout({ paidOut, onTakeBack }: { paidOut: PaidOut; onTakeBack: (payoutId: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function takeBack() {
    setSaving(true)
    setRefusal(null)

    try {
      await onTakeBack(paidOut._id)
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-3.5">
      <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{paidOut.personName}</span>
      {/* Brass, because it is money leaving the partnership, the same colour it is given under Paid. */}
      <Figure className="text-brass text-right text-lg">{formatPaisa(paidOut.amountPaisa)}</Figure>
      <span className="text-muted-foreground col-span-2 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span>
          {SAID[paidOut.method]} · {paidOut.day}
          {paidOut.reference === undefined ? '' : ` · ${paidOut.reference}`}
        </span>
        <button
          type="button"
          onClick={takeBack}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          {saving ? 'Taking it back…' : 'Take it back'}
        </button>
      </span>
      {refusal === null ? null : (
        <span role="alert" className="text-destructive col-span-2 text-sm">
          {refusal}
        </span>
      )}
    </li>
  )
}

// What is coming, drawn in its own shape: a name, a figure to the right of it, and the line underneath saying how it went.
function AlreadyOutWaiting() {
  return (
    <WhileWaiting what="Getting what has gone back to them">
      <div className="divide-hairline flex flex-col divide-y">
        {/* Two, because a handful of partners are paid a handful of times and a screenful of grey bars promises a longer list than is coming. */}
        {[0, 1].map((row) => (
          <div key={row} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-3.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
            <div className="col-span-2 flex">
              <SkeletonLines widths={['w-52']} />
            </div>
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
