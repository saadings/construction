import { useState } from 'react'
import { formatPaisa, groupWhileTyping } from '~shared/money'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'
import { Pick } from '../form/Pick'
import { Figure } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type Engaged = {
  engagementId: string
  personName: string
  tradeName: string
  agreedPaisa?: number
  ratePaisa?: number
  unit?: string
  billedPaisa: number
  paidPaisa: number
}

export type Claimed = {
  _id: string
  day: string
  amountPaisa: number
  personName: string
  tradeName: string
  reference?: string
  description?: string
}

export type Named = { _id: string; name: string }

export type NewEngagement = { personId: string; tradeId: string; agreed?: string; rate?: string; unit?: string }
export type NewBill = { personId: string; tradeId: string; day: string; amount: string; reference?: string }

// The same markup at every width. A phone gets who and what is left; a desk gets the three figures between them as well.
const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]'

// Who is on this house, what was agreed with them, what they say they are owed, and what has gone out to them.

// Three figures and not one: Akram agreed 300,000, billed 340,000 once extra work landed, and was paid 325,000. Agreed against billed is the extra work; billed against paid is the balance. Neither can be worked out from the other.
export function WhoIsOnThisHouse({
  engaged,
  claimed,
  people,
  trades,
  saving,
  refusal,
  takingOut,
  onAgree,
  onRaise,
  onTakeOut,
}: {
  // Handed over as they came. `undefined` is a reading on its way; `null` is a house that is not there.
  engaged: Array<Engaged> | null | undefined
  claimed: Array<Claimed> | null | undefined
  people: Array<Named> | null | undefined
  trades: Array<Named> | null | undefined
  saving: boolean
  refusal: string | null
  takingOut: string | null
  onAgree: (engagement: NewEngagement) => Promise<boolean>
  onRaise: (bill: NewBill) => Promise<boolean>
  onTakeOut: (billId: string) => Promise<boolean>
}) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">People on this house</h2>

      <TheSpread engaged={engaged} />

      <PutSomebodyOn
        people={people ?? []}
        trades={trades ?? []}
        saving={saving}
        refusal={refusal}
        onAgree={onAgree}
        onRaise={onRaise}
      />

      <WhatIsClaimed claimed={claimed} takingOut={takingOut} onTakeOut={onTakeOut} />
    </section>
  )
}

function TheSpread({ engaged }: { engaged: Array<Engaged> | null | undefined }) {
  if (engaged === undefined) {
    return <SpreadWaiting />
  }

  if (engaged === null) {
    return null
  }

  if (engaged.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nobody is down on this house yet. Put somebody on a trade with what was agreed, and what they bill against it
        reads beside it.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      <div
        className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
      >
        <span>Who</span>
        <span className="text-right">Agreed</span>
        <span className="text-right">Billed</span>
        <span className="text-right">Paid</span>
        <span className="text-right">Left</span>
      </div>

      <ul className="divide-hairline flex flex-col divide-y">
        {engaged.map((one) => (
          <li key={one.engagementId} className={`${ROW} py-3.5`}>
            <span className="min-w-0">
              <span className="text-foreground block truncate text-[1.0625rem]">{one.personName}</span>
              <span className="text-muted-foreground block truncate text-sm">{one.tradeName}</span>
            </span>

            <Cell label="Agreed">{whatWasAgreed(one)}</Cell>
            <Cell label="Billed">{formatPaisa(one.billedPaisa)}</Cell>
            {/* Brass, because it is money that has gone out. */}
            <Cell label="Paid" tone="text-brass">
              {formatPaisa(one.paidPaisa)}
            </Cell>
            {/* Green, because what is left is money still owed to him. */}
            <Cell label="Left" tone="text-green">
              {formatPaisa(one.billedPaisa - one.paidPaisa)}
            </Cell>
          </li>
        ))}
      </ul>
    </div>
  )
}

// A lump sum reads as a figure; a rate reads as the rate and what it is for, because "450 a square foot" is what was agreed and 450 on its own is not.
function whatWasAgreed(one: Engaged): string {
  if (one.agreedPaisa !== undefined) return formatPaisa(one.agreedPaisa)
  if (one.ratePaisa !== undefined) return `${formatPaisa(one.ratePaisa)} a ${one.unit ?? 'unit'}`

  return '—'
}

function Cell({ label, tone, children }: { label: string; tone?: string; children: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 sm:justify-end">
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase sm:hidden">{label}</span>
      <Figure className={`${tone ?? 'text-foreground'} text-right`}>{children}</Figure>
    </span>
  )
}

type Doing = 'agree' | 'raise'

// One form, two things it can be doing, because they ask nearly the same questions of nearly the same people: who, which trade, and a figure.
function PutSomebodyOn({
  people,
  trades,
  saving,
  refusal,
  onAgree,
  onRaise,
}: {
  people: Array<Named>
  trades: Array<Named>
  saving: boolean
  refusal: string | null
  onAgree: (engagement: NewEngagement) => Promise<boolean>
  onRaise: (bill: NewBill) => Promise<boolean>
}) {
  const [open, setOpen] = useState<Doing | null>(null)

  if (open === null) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button look="beside" onClick={() => setOpen('agree')}>
          Put somebody on a trade
        </Button>
        <Button look="beside" onClick={() => setOpen('raise')}>
          Somebody has billed us
        </Button>
      </div>
    )
  }

  return (
    <TheForm
      doing={open}
      people={people}
      trades={trades}
      saving={saving}
      refusal={refusal}
      onDone={() => setOpen(null)}
      onAgree={onAgree}
      onRaise={onRaise}
    />
  )
}

function TheForm({
  doing,
  people,
  trades,
  saving,
  refusal,
  onDone,
  onAgree,
  onRaise,
}: {
  doing: Doing
  people: Array<Named>
  trades: Array<Named>
  saving: boolean
  refusal: string | null
  onDone: () => void
  onAgree: (engagement: NewEngagement) => Promise<boolean>
  onRaise: (bill: NewBill) => Promise<boolean>
}) {
  const [personId, setPersonId] = useState('')
  const [tradeId, setTradeId] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [unit, setUnit] = useState('')
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')

  const agreeing = doing === 'agree'
  const wrongPerson = personId === '' ? 'Say who this is.' : null
  const wrongTrade = tradeId === '' ? 'Say what it is for.' : null
  // A rate is the other way of agreeing, so an empty figure is only wrong where neither is filled in.
  const wrongAmount =
    agreeing && rate.trim() !== ''
      ? null
      : amount.trim() === ''
        ? agreeing
          ? 'Put in what was agreed, either a whole figure or a rate.'
          : 'Put in how much they have billed.'
        : null

  async function send() {
    const wentIn = agreeing
      ? await onAgree({
          personId,
          tradeId,
          agreed: amount.trim() === '' ? undefined : amount,
          rate: rate.trim() === '' ? undefined : rate,
          unit: unit.trim() === '' ? undefined : unit,
        })
      : await onRaise({
          personId,
          tradeId,
          day,
          amount,
          reference: reference.trim() === '' ? undefined : reference,
        })

    // Only when it went in. The refusal above the button is about what is still in the boxes.
    if (wentIn) onDone()
  }

  return (
    <div className="border-border flex w-full max-w-2xl flex-col gap-5 rounded-md border p-4">
      <div className="grid gap-5 sm:grid-cols-2">
        <Pick
          label="Who"
          problem={wrongPerson}
          placeholder="Pick one"
          chosen={people.find((person) => person._id === personId) ?? null}
          choices={people}
          onPick={(picked) => {
            setPersonId(picked === null ? '' : pickedFrom(people, picked._id))
          }}
        />

        <Pick
          label="What for"
          problem={wrongTrade}
          placeholder="Pick one"
          chosen={trades.find((trade) => trade._id === tradeId) ?? null}
          choices={trades}
          onPick={(picked) => {
            setTradeId(picked === null ? '' : pickedFrom(trades, picked._id))
          }}
        />
      </div>

      <Field
        label={agreeing ? 'What was agreed' : 'How much they have billed'}
        hint={agreeing ? 'A whole figure, or leave it empty and put in a rate instead.' : undefined}
        problem={wrongAmount}
      >
        <Line
          value={amount}
          onChange={(event) => setAmount(groupWhileTyping(event.target.value))}
          inputMode="decimal"
          aria-label={agreeing ? 'What was agreed' : 'How much they have billed'}
          placeholder="0"
        />
      </Field>

      {agreeing ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Or a rate">
            <Line
              value={rate}
              onChange={(event) => setRate(groupWhileTyping(event.target.value))}
              inputMode="decimal"
              aria-label="Or a rate"
              placeholder="0"
            />
          </Field>

          <Field label="For each" hint="A square foot, a load, a day.">
            <Line value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="For each" />
          </Field>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Which day">
            <Line value={day} onChange={(event) => setDay(event.target.value)} type="date" aria-label="Which day" />
          </Field>

          <Field label="Their bill number" hint="Leave it empty if there is none.">
            <Line
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              aria-label="Their bill number"
              autoComplete="off"
            />
          </Field>
        </div>
      )}

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={send} busy={saving}>
          {agreeing ? 'Agree it' : 'Put it down'}
        </Button>
        <Button look="beside" onClick={onDone}>
          Never mind
        </Button>
      </div>
    </div>
  )
}

// A picker hands back plain text, so the answer is looked up in the list it was drawn from rather than trusted to be an id.
function pickedFrom<TRow extends { _id: string }>(rows: Array<TRow>, chosen: string): string {
  return rows.find((row) => row._id === chosen)?._id ?? ''
}

function WhatIsClaimed({
  claimed,
  takingOut,
  onTakeOut,
}: {
  claimed: Array<Claimed> | null | undefined
  takingOut: string | null
  onTakeOut: (billId: string) => Promise<boolean>
}) {
  if (claimed === undefined) {
    return <ClaimedWaiting />
  }

  if (claimed === null || claimed.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">What has been billed to us</h3>

      <ul className="divide-hairline flex flex-col divide-y">
        {claimed.map((one) => (
          <Bill key={one._id} bill={one} takingOut={takingOut === one._id} onTakeOut={onTakeOut} />
        ))}
      </ul>
    </div>
  )
}

function Bill({
  bill,
  takingOut,
  onTakeOut,
}: {
  bill: Claimed
  takingOut: boolean
  onTakeOut: (billId: string) => Promise<boolean>
}) {
  // Asked once and then done, in place. A bill cannot be put back from a screen, and somebody disputing one is the case the record is kept for.
  const [asking, setAsking] = useState(false)

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[0.9375rem]">{bill.personName}</p>
        <p className="text-muted-foreground truncate text-sm">
          {bill.tradeName} · {bill.day}
          {bill.reference === undefined ? '' : ` · ${bill.reference}`}
          {bill.description === undefined ? '' : ` · ${bill.description}`}
        </p>
      </div>

      {/* Green, because a bill is money owed to him rather than money gone out. */}
      <Figure className="text-green shrink-0 text-[0.9375rem]">{formatPaisa(bill.amountPaisa)}</Figure>

      {asking ? (
        <span className="flex shrink-0 items-baseline gap-3">
          <span className="text-muted-foreground text-sm">Hide it?</span>
          <button
            type="button"
            onClick={() => {
              void onTakeOut(bill._id)
            }}
            disabled={takingOut}
            className="text-destructive text-sm font-medium disabled:opacity-50"
          >
            {takingOut ? 'Taking it out…' : 'Yes, take it out'}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="text-muted-foreground text-sm">
            Never mind
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          aria-label={`Take out ${formatPaisa(bill.amountPaisa)} billed by ${bill.personName}`}
          className="text-muted-foreground shrink-0 text-sm"
        >
          Take out
        </button>
      )}
    </li>
  )
}

function SpreadWaiting() {
  return (
    <WhileWaiting what="Getting who is on this house">
      <div className="divide-hairline flex flex-col divide-y">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-baseline justify-between gap-4 py-3.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}

function ClaimedWaiting() {
  return (
    <WhileWaiting what="Getting what has been billed">
      <div className="flex items-baseline justify-between gap-4 py-2">
        <Skeleton className="h-4 w-36 max-w-full" />
        <Skeleton className="h-4 w-20 shrink-0" />
      </div>
    </WhileWaiting>
  )
}
