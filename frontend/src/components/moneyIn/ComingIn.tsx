import { useState } from 'react'
import { formatPaisa, groupWhileTyping } from '~shared/money'
import type { HowPaid } from '~shared/validation/howMoneyMoved'
import { asksForBank, asksForChequeNumber } from '~shared/validation/howMoneyMoved'
import type { WhyItCame } from '~shared/validation/moneyIn'
import { SAY_IN } from '~shared/validation/moneyIn'

import { Button } from '../form/Button'
import { Choices, Field, Line, Lines, Picker } from '../form/Field'
import { Figure, Form, Page } from '../shell/Page'
import { Skeleton, SkeletonLines, WhileWaiting } from '../shell/Skeleton'

export type Received = {
  _id: string
  day: string
  amountPaisa: number
  fromName: string
  why: WhyItCame
  reference?: string
  note?: string
}

export type Person = { _id: string; name: string }
export type Account = { _id: string; label: string }

export type NewReceipt = {
  day: string
  amount: string
  fromId: string
  why: WhyItCame
  method: HowPaid
  reference?: string
  bankAccountId?: string
  note?: string
}

// What the money is, in the words somebody would say. The value is the schema's, so a reason cannot appear here without existing there.
const WHY: Array<{ value: WhyItCame; label: string }> = [
  { value: 'partnerMoney', label: 'A partner put it in' },
  { value: 'clientPayment', label: 'The client paid' },
  { value: 'sale', label: 'The house sold' },
]

const HOW: Array<{ value: HowPaid; label: string }> = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'payOrder', label: 'Pay order' },
]

// The other half of the day sheet. Money going out has had a screen since the first day; this is what came in against it.
export function ComingIn({
  siteName,
  received,
  people,
  accounts,
  saving,
  refusal,
  onPutIn,
}: {
  siteName: string
  received: Array<Received> | null | undefined
  people: Array<Person> | null | undefined
  accounts: Array<Account> | null | undefined
  saving: boolean
  refusal: string | null
  // Answers whether it went in, because the boxes may only be emptied when it did. A refusal that wipes what was typed makes him type the lot again to read what he got wrong.
  onPutIn: (receipt: NewReceipt) => Promise<boolean>
}) {
  return (
    <Page title="Money coming in" beside={<span className="text-muted-foreground text-sm">{siteName}</span>}>
      <Taking people={people ?? []} accounts={accounts ?? []} saving={saving} refusal={refusal} onPutIn={onPutIn} />

      <AlreadyIn received={received} />
    </Page>
  )
}

function Taking({
  people,
  accounts,
  saving,
  refusal,
  onPutIn,
}: {
  people: Array<Person>
  accounts: Array<Account>
  saving: boolean
  refusal: string | null
  onPutIn: (receipt: NewReceipt) => Promise<boolean>
}) {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState('')
  const [why, setWhy] = useState<WhyItCame>('clientPayment')
  const [method, setMethod] = useState<HowPaid>('transfer')
  const [reference, setReference] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [note, setNote] = useState('')
  // Counted rather than a flag, because the second receipt has to empty the form as thoroughly as the first.
  const [gonein, setGoneIn] = useState(0)

  // Asked from the same rules the server refuses by, so the screen and the schema cannot drift into disagreeing.
  const wrongFrom = fromId === '' ? SAY_IN.from : null
  const wrongReference = asksForChequeNumber(method) && reference.trim() === '' ? SAY_IN.reference : null
  const wrongBank = asksForBank(method) && bankAccountId === '' ? SAY_IN.bank : null
  const wrongAmount = amount.trim() === '' ? 'Put in how much came in.' : null

  async function put() {
    const wentIn = await onPutIn({
      day,
      amount,
      fromId,
      why,
      method,
      reference: asksForChequeNumber(method) ? reference.trim() : undefined,
      bankAccountId: (asksForBank(method) ? bankAccountId : '') || undefined,
      note: note.trim() === '' ? undefined : note,
    })

    // Only when it went in. The refusal above the button is about the amount still in the box, and emptying the box leaves him reading it against nothing.
    if (!wentIn) return

    setAmount('')
    setReference('')
    setNote('')
    setGoneIn((times) => times + 1)
  }

  return (
    <Form freshAfter={gonein}>
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

      <Field label="Who it came from" problem={wrongFrom}>
        <Picker
          value={fromId}
          onChange={(event) => setFromId(pickedFrom(people, event.target.value))}
          aria-label="Who it came from"
        >
          <option value="">Pick one</option>
          {people.map((person) => (
            <option key={person._id} value={person._id}>
              {person.name}
            </option>
          ))}
        </Picker>
      </Field>

      <Choices label="What this money is">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {WHY.map((one) => (
            <Choice key={one.value} label={one.label} chosen={why === one.value} onChoose={() => setWhy(one.value)} />
          ))}
        </div>
      </Choices>

      <Choices label="How it came">
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
        <Field label="Which account it landed in" problem={wrongBank}>
          <Picker
            value={bankAccountId}
            onChange={(event) => setBankAccountId(pickedFrom(accounts, event.target.value))}
            aria-label="Which account it landed in"
          >
            <option value="">Pick one</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account.label}
              </option>
            ))}
          </Picker>
        </Field>
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
        <Button onClick={put} busy={saving}>
          Put it in
        </Button>
      </div>
    </Form>
  )
}

// A picker hands back plain text, so the answer is looked up in the list it was drawn from rather than trusted to be an id.
function pickedFrom<TRow extends { _id: string }>(rows: Array<TRow>, chosen: string): string {
  return rows.find((row) => row._id === chosen)?._id ?? ''
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

const SAID: Record<WhyItCame, string> = {
  partnerMoney: 'A partner',
  clientPayment: 'The client',
  sale: 'The sale',
}

function AlreadyIn({ received }: { received: Array<Received> | null | undefined }) {
  if (received === undefined) {
    return <AlreadyInWaiting />
  }

  if (received === null) {
    return null
  }

  if (received.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing has come in on this house yet.</p>
  }

  return (
    <ul className="divide-hairline flex flex-col divide-y">
      {received.map((one) => (
        <li key={one._id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-3.5">
          <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{one.fromName}</span>
          {/* Green, because it is money coming to the partnership rather than leaving it. */}
          <Figure className="text-green text-right text-lg">{formatPaisa(one.amountPaisa)}</Figure>
          <span className="text-muted-foreground col-span-2 text-sm">
            {SAID[one.why]} · {one.day}
            {one.reference === undefined ? '' : ` · ${one.reference}`}
          </span>
        </li>
      ))}
    </ul>
  )
}

// What is coming, drawn in its own shape: a name, a figure to the right of it, and the line underneath saying where it came from.
function AlreadyInWaiting() {
  return (
    <WhileWaiting what="Getting what has come in">
      <div className="divide-hairline flex flex-col divide-y">
        {/* Three, because money arriving on one house is a short list and a screenful of grey bars promises more than is coming. */}
        {[0, 1, 2].map((row) => (
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
