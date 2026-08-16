import { useState } from 'react'
import { asDayHeWrites } from '~shared/calendarDate'
import { formatPaisa, groupWhileTyping } from '~shared/money'

import { Button } from '../form/Button'
import { Day } from '../form/Day'
import { Field, Line } from '../form/Field'
import { NOBODY, PickAPerson, asAsked } from '../form/PickAPerson'
import { PickATrade } from '../form/PickATrade'
import { StillSending } from '../form/StillSending'
import { WayOut } from '../form/WayOut'
import { useWhatWasAdded } from '../form/whatWasAdded'
import { Figure, NothingIsDeleted, SaidUnderneath } from '../shell/Page'
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

// Who, said the way every screen says it now: an id when he was picked, a name when he was typed, never both.
type Who = { personId?: string; newPerson?: string }

export type NewEngagement = Who & { tradeId: string; agreed?: string; rate?: string; unit?: string }
export type NewBill = Who & { tradeId: string; day: string; amount: string; reference?: string }

// The same markup at every width. A phone gets who and what is left; a desk gets the three figures between them as well.

// One grid for the whole list, and every row takes its columns from it. Written per row, each row sized its own `auto` track to its own content -- not seen to move today, and not defended against it either: every last cell happens to be a figure of much the same width.
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]'

/** A row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

/** Everything between the grid and a row -- a list, a list item -- which has to pass the columns down rather than stop them. */
const PASSES_THEM_DOWN = 'col-span-full grid grid-cols-subgrid'

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
  onAddTrade,
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
  // The same offer the day sheet has. `What for` here picks from the same list, and a trade missing from it stops the same work.
  onAddTrade: (trade: { name: string; countsAsBuildingCost: boolean }) => Promise<string>
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
        onAddTrade={onAddTrade}
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
    <div className={GRID}>
      <div
        className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
      >
        <span>Who</span>
        <span className="text-right">Agreed</span>
        <span className="text-right">Billed</span>
        <span className="text-right">Paid</span>
        <span className="text-right">Left</span>
      </div>

      <ul className={`${PASSES_THEM_DOWN} divide-hairline divide-y`}>
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
  onAddTrade,
}: {
  people: Array<Named>
  trades: Array<Named>
  saving: boolean
  refusal: string | null
  onAgree: (engagement: NewEngagement) => Promise<boolean>
  onRaise: (bill: NewBill) => Promise<boolean>
  onAddTrade: (trade: { name: string; countsAsBuildingCost: boolean }) => Promise<string>
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
      onAddTrade={onAddTrade}
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
  onAddTrade,
}: {
  doing: Doing
  people: Array<Named>
  trades: Array<Named>
  saving: boolean
  refusal: string | null
  onDone: () => void
  onAgree: (engagement: NewEngagement) => Promise<boolean>
  onRaise: (bill: NewBill) => Promise<boolean>
  onAddTrade: (trade: { name: string; countsAsBuildingCost: boolean }) => Promise<string>
}) {
  // Anything added from the picker since this form opened, which the list it was picked from does not have yet.
  const everyTrade = useWhatWasAdded(trades)

  const [who, setWho] = useState(NOBODY)
  const [tradeId, setTradeId] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [unit, setUnit] = useState('')
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')

  const agreeing = doing === 'agree'
  const wrongPerson = who.personId === '' && who.newPerson === '' ? 'Say who this is.' : null
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
          ...asAsked(who),
          tradeId,
          agreed: amount.trim() === '' ? undefined : amount,
          rate: rate.trim() === '' ? undefined : rate,
          unit: unit.trim() === '' ? undefined : unit,
        })
      : await onRaise({
          ...asAsked(who),
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
        <PickAPerson label="Who" problem={wrongPerson} who={who} people={people} onChange={setWho} />

        <PickATrade
          label="Trade"
          problem={wrongTrade}
          placeholder="Pick one"
          chosen={everyTrade.everything.find((trade) => trade._id === tradeId) ?? null}
          trades={everyTrade.everything}
          onPick={(picked) => {
            setTradeId(picked === null ? '' : everyTrade.pickedFromThese(picked._id))
          }}
          onAdd={async (trade) => {
            const _id = await onAddTrade(trade)
            everyTrade.remember({ _id, name: trade.name })

            return _id
          }}
        />
      </div>

      <Field
        label={agreeing ? 'What was agreed' : 'Amount billed'}
        hint={agreeing ? 'A whole figure, or leave it empty and put in a rate instead.' : undefined}
        problem={wrongAmount}
      >
        <Line
          value={amount}
          onChange={(event) => setAmount(groupWhileTyping(event.target.value))}
          inputMode="decimal"
          aria-label={agreeing ? 'What was agreed' : 'Amount billed'}
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
          <Day label="Date" value={day} onPick={setDay} />

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

      <StillSending busy={saving} />
      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={send} busy={saving}>
          {agreeing ? 'Agree' : 'Save'}
        </Button>
        <Button look="beside" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
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

      <ul className={`${PASSES_THEM_DOWN} divide-hairline divide-y`}>
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
        {/* Not truncated, unlike the name above it. The reasons are with the component now, because the payment list on the next screen was still cutting its cheque numbers off while this one was right. */}
        <SaidUnderneath pieces={[bill.tradeName, asDayHeWrites(bill.day), bill.reference, bill.description]} />
      </div>

      {/* Green, because a bill is money owed to him rather than money gone out. */}
      <Figure className="text-green shrink-0 text-[0.9375rem]">{formatPaisa(bill.amountPaisa)}</Figure>

      {asking ? (
        <span className="flex shrink-0 items-baseline gap-3">
          <span className="text-muted-foreground text-sm">Remove this?</span>
          <Button
            look="removing"
            onClick={() => {
              void onTakeOut(bill._id)
            }}
            disabled={takingOut}
          >
            {takingOut ? 'Removing…' : 'Yes, remove'}
          </Button>
          <WayOut onClick={() => setAsking(false)}>Cancel</WayOut>
          <NothingIsDeleted />
        </span>
      ) : (
        <WayOut
          onClick={() => setAsking(true)}
          aria-label={`Remove ${formatPaisa(bill.amountPaisa)} billed by ${bill.personName}`}
          className="shrink-0"
        >
          Remove
        </WayOut>
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
