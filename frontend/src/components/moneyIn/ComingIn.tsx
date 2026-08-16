import { useState } from 'react'
import { asDayHeWrites } from '~shared/calendarDate'
import { formatPaisa, groupWhileTyping } from '~shared/money'
import type { HowPaid } from '~shared/validation/howMoneyMoved'
import { asksForBank, asksForChequeNumber } from '~shared/validation/howMoneyMoved'
import type { WhyItCame } from '~shared/validation/moneyIn'
import { SAY_IN } from '~shared/validation/moneyIn'

import { Button } from '../form/Button'
import { Choices } from '../form/Choices'
import { Day } from '../form/Day'
import { Field, Line, Lines } from '../form/Field'
import type { Part } from '../form/HowItWasPaid'
import { HowItWasPaid, onePart, whatEachPartIsWorth } from '../form/HowItWasPaid'
import { Pick } from '../form/Pick'
import { StillSending } from '../form/StillSending'
import { WayOut } from '../form/WayOut'
import { useWhatWasAdded } from '../form/whatWasAdded'
import { whatWentWrong } from '../form/whatWentWrong'
import { Figure, Form, NothingIsDeleted, Page, SaidUnderneath } from '../shell/Page'
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

// One arrival, and one of these per way it came: 200,000 by cheque and 100,000 in cash is two rows sharing a day, a person and a reason. Nauman asked for it and chose separate rows, so nothing here says they belong together.
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
const WHY: Array<{ is: WhyItCame; said: string }> = [
  { is: 'partnerMoney', said: 'A partner put it in' },
  { is: 'clientPayment', said: 'The client paid' },
  { is: 'sale', said: 'The house sold' },
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
  onTakeBack,
  onAddAccount,
}: {
  siteName: string
  received: Array<Received> | null | undefined
  people: Array<Person> | null | undefined
  accounts: Array<Account> | null | undefined
  saving: boolean
  refusal: string | null
  // Answers whether it went in, because the boxes may only be emptied when it did. A refusal that wipes what was typed makes him type the lot again to read what he got wrong.
  onPutIn: (arrivals: Array<NewReceipt>) => Promise<boolean>
  // Money going out could be taken back from the first day and money coming in could not. A partner's capital entered wrong was permanent, and capital is what the whole profit split is worked out from.
  onTakeBack: (moneyInId: string) => Promise<void>
  // The same offer the day sheet has, for the same reason: the picker is where somebody is looking when they find the account missing, and money coming in had no way to add one at all.
  onAddAccount: (label: string, lastFourDigits: string) => Promise<string>
}) {
  return (
    // No house name beside the title any more: the trail above says it and links back to it.
    <Page title="Invested" named={{ siteId: siteName }}>
      <Taking
        people={people ?? []}
        accounts={accounts ?? []}
        saving={saving}
        refusal={refusal}
        onPutIn={onPutIn}
        onAddAccount={onAddAccount}
      />

      <AlreadyIn received={received} onTakeBack={onTakeBack} />
    </Page>
  )
}

function Taking({
  people,
  accounts,
  saving,
  refusal,
  onPutIn,
  onAddAccount,
}: {
  people: Array<Person>
  accounts: Array<Account>
  saving: boolean
  refusal: string | null
  onPutIn: (arrivals: Array<NewReceipt>) => Promise<boolean>
  onAddAccount: (label: string, lastFourDigits: string) => Promise<string>
}) {
  // The list as read, plus anything added from the picker since this form opened.
  const everyAccount = useWhatWasAdded(accounts)

  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState('')
  const [why, setWhy] = useState<WhyItCame>('clientPayment')
  const [parts, setParts] = useState<Array<Part>>(() => [onePart('transfer')])
  const [note, setNote] = useState('')
  // Counted rather than a flag, because the second receipt has to empty the form as thoroughly as the first.
  const [gonein, setGoneIn] = useState(0)

  // Asked from the same rules the server refuses by, so the screen and the schema cannot drift into disagreeing.
  const wrongFrom = fromId === '' ? SAY_IN.from : null
  const wrongAmount = amount.trim() === '' ? 'Put in how much came in.' : null

  async function put() {
    const worth = whatEachPartIsWorth(amount, parts)

    const wentIn = await onPutIn(
      parts.map((part, at) => ({
        day,
        amount: worth[at],
        fromId,
        why,
        method: part.method,
        reference: asksForChequeNumber(part.method) ? part.reference.trim() : undefined,
        bankAccountId: (asksForBank(part.method) ? part.bankAccountId : '') || undefined,
        note: note.trim() === '' ? undefined : note,
      }))
    )

    // Only when it went in. The refusal above the button is about the amount still in the box, and emptying the box leaves him reading it against nothing.
    if (!wentIn) return

    setAmount('')
    // The ways it came stay, emptied of their figures: the same account and the same cheque book is what a run of receipts looks like.
    setParts((was) => was.map((part) => ({ ...part, amount: '', reference: '' })))
    setNote('')
    setGoneIn((times) => times + 1)
  }

  return (
    <Form freshAfter={gonein}>
      <div className="grid gap-6 sm:grid-cols-2">
        {/* The control this app draws rather than the OS one, which prints the browser's own order: a picture from CI showed `07/04/2026` where the app means the fourth of July. */}
        <Day label="Date" value={day} onPick={setDay} />

        <Field label="Amount" problem={wrongAmount}>
          <Line
            value={amount}
            onChange={(event) => setAmount(groupWhileTyping(event.target.value))}
            inputMode="decimal"
            aria-label="Amount"
            placeholder="0"
          />
        </Field>
      </div>

      <Pick
        label="Received from"
        problem={wrongFrom}
        placeholder="Pick one, or type a name"
        chosen={people.find((person) => person._id === fromId) ?? null}
        choices={people}
        // A buyer is nobody in the ledger until the day he pays, so a name typed here becomes a person the same way a payee does.
        canUseANewName
        onPick={(picked) => {
          setFromId(picked === null ? '' : pickedFrom(people, picked._id))
        }}
      />

      {/* One under the other on a phone: `A partner put it in` in a third of 390px is three lines in a box meant for one. */}
      <Choices label="Type" across={1} chosen={why} choices={WHY} onChoose={setWhy} />

      {/* Every way this one arrival came in. What is typed once -- the day, who it came from, what it is, the amount -- is shared, and each way carries its own cheque number or account. */}
      <HowItWasPaid
        label="Payment method"
        parts={parts}
        total={amount}
        accounts={everyAccount.everything}
        bankLabel="Which account it landed in"
        onChange={setParts}
        onAddAccount={async (label, lastFourDigits) => {
          const _id = await onAddAccount(label, lastFourDigits)
          everyAccount.remember({ _id, label })

          return _id
        }}
      />

      <Field label="Note">
        <Lines value={note} onChange={(event) => setNote(event.target.value)} aria-label="Note" />
      </Field>

      <StillSending busy={saving} />
      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      {/* At the foot of the form and not pinned to the screen, which is the opposite of the day sheet and is chosen rather than overlooked. */}

      {/* On a phone this button is below the fold behind seven questions, and a pinned footer would put it back in reach -- at the cost of roughly a tenth of the screen, on every one of those questions, to save one scroll made once. The day sheet pays that willingly because a sitting is twenty payments and the buttons are pressed twenty times; money coming in is one receipt, and the scroll happens once at the end of a form somebody is already reading downwards. */}
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

const SAID: Record<WhyItCame, string> = {
  partnerMoney: 'A partner',
  clientPayment: 'The client',
  sale: 'The sale',
}

function AlreadyIn({
  received,
  onTakeBack,
}: {
  received: Array<Received> | null | undefined
  onTakeBack: (moneyInId: string) => Promise<void>
}) {
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
        <OneReceipt key={one._id} received={one} onTakeBack={onTakeBack} />
      ))}
    </ul>
  )
}

// Taken back out, never erased, and signed by whoever did it. A partner's capital vanishing without a signature is the exact case a disagreement about money turns on.
function OneReceipt({
  received,
  onTakeBack,
}: {
  received: Received
  onTakeBack: (moneyInId: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [asking, setAsking] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function takeBack() {
    setSaving(true)
    setRefusal(null)

    try {
      await onTakeBack(received._id)
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-3.5">
      <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{received.fromName}</span>
      {/* Green, because it is money coming to the partnership rather than leaving it. */}
      <Figure className="text-green text-right text-lg">{formatPaisa(received.amountPaisa)}</Figure>
      <span className="text-muted-foreground col-span-2 flex flex-wrap items-baseline gap-x-3 text-sm">
        {/* The fourth place this line was written by hand. This one loses no reference outright -- it is not truncated -- but a browser breaks `CH-114` at its own hyphen, and a receipt number in two halves is no better than one cut short. */}
        <SaidUnderneath pieces={[SAID[received.why], asDayHeWrites(received.day), received.reference]} />

        {/* Asked before it happens, which it was not until the label changed. `Take it back` was soft enough to be its own warning; `Remove` is not, and a partner's capital is what the whole profit split is worked out from. */}
        {asking ? (
          <>
            <span className="text-muted-foreground text-sm">Remove this?</span>
            <Button look="removing" onClick={takeBack} disabled={saving}>
              {saving ? 'Removing…' : 'Yes, remove'}
            </Button>
            <WayOut onClick={() => setAsking(false)}>Cancel</WayOut>
            <NothingIsDeleted />
          </>
        ) : (
          <WayOut onClick={() => setAsking(true)}>Remove</WayOut>
        )}
      </span>
      {refusal === null ? null : (
        <span role="alert" className="text-destructive col-span-2 text-sm">
          {refusal}
        </span>
      )}
    </li>
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
