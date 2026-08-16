import { formatPaisa, groupWhileTyping, readRupees } from '~shared/money'
import type { HowPaid } from '~shared/validation/howMoneyMoved'
import { HOW_PAID, asksForBank, asksForChequeNumber } from '~shared/validation/howMoneyMoved'

import { cn } from '../../lib/utils'
import { Figure } from '../shell/Page'
import { Button } from './Button'
import { Choices, Field, Line } from './Field'
import { asChoices } from './Pick'
import type { Account } from './PickAnAccount'
import { PickAnAccount } from './PickAnAccount'
import { WayOut } from './WayOut'

// Nauman: "Sometimes we pay by cash and cheques so we need the ability to split between each."

// He was given the choice and took it in these words: separate lines, entered once, saved as one row per method -- "correcting or removing one part leaves the other standing". So nothing here links the parts to each other. They share a day, a person and a trade because he typed those once, and after that they are ordinary payments.

// The words on the buttons. The values are the schema's, so a new way of paying cannot appear here without existing there.
const SAID = { cheque: 'Cheque', cash: 'Cash', transfer: 'Transfer', payOrder: 'Pay order' } as const

/** One way a payment was settled: how, how much of it, and whatever that way asks for. */
export type Part = { method: HowPaid; amount: string; reference: string; bankAccountId: string }

export function onePart(method: HowPaid = 'cheque'): Part {
  return { method, amount: '', reference: '', bankAccountId: '' }
}

/** What each part is worth, with the whole figure standing in for a single part -- one way of paying takes all of it, and asking him to type the amount twice is how a screen earns the word bureaucratic. */
export function whatEachPartIsWorth(total: string, parts: Array<Part>): Array<string> {
  return parts.length === 1 ? [total] : parts.map((part) => part.amount)
}

/** How the parts stand against the figure above them: what is still unsplit, and how many parts hold something this cannot read. `null` is not zero -- a part reading `111,111,111,111` is not a part worth nothing. */
export function howThePartsStand(total: string, parts: Array<Part>): { leftPaisa: number | null; unreadable: number } {
  const whole = readRupees(total)
  let split = 0
  let unreadable = 0

  for (const amount of whatEachPartIsWorth(total, parts)) {
    if (amount.trim() === '') continue

    const part = readRupees(amount)
    if (part.ok) split += part.paisa
    else unreadable += 1
  }

  return { leftPaisa: whole.ok ? whole.paisa - split : null, unreadable }
}

/** What the arithmetic says, or `null` when there is nothing to say. Worked out apart from the sentence so a test can ask which of the four states it is in, and so the figure inside it can be set in the face every other figure in this app is set in. */
export type HowItStands =
  | { said: 'unreadable'; parts: number }
  | { said: 'all of it' }
  | { said: 'still to split'; paisa: number }
  | { said: 'more than the amount above'; paisa: number }

export function howItStands(total: string, parts: Array<Part>): HowItStands | null {
  if (parts.length < 2) return null

  const { leftPaisa, unreadable } = howThePartsStand(total, parts)

  if (unreadable > 0) return { said: 'unreadable', parts: unreadable }

  // The amount above cannot be read, so there is nothing to measure the parts against. `MoneyLine` is already saying what is wrong with it, and a second sentence here would be the same complaint twice.
  if (leftPaisa === null) return null

  // Nothing left is an answer, not the absence of one. Falling through to no sentence makes a finished split look exactly like one nobody has started -- the not-there-reading-as-a-value this repository keeps finding, arriving in the one place he is doing arithmetic.
  if (leftPaisa === 0) return { said: 'all of it' }

  return leftPaisa > 0
    ? { said: 'still to split', paisa: leftPaisa }
    : { said: 'more than the amount above', paisa: -leftPaisa }
}

/** The sentence, with its figure in the face that lines figures up. Said while he types rather than refused when he sends: he is standing on a site with a cheque book. */
function WhereTheSplitHasGot({ standing }: { standing: HowItStands }) {
  if (standing.said === 'unreadable') {
    return standing.parts === 1
      ? 'One of these is not a figure this can add.'
      : `${String(standing.parts)} of these are not figures this can add.`
  }

  if (standing.said === 'all of it') return 'That is all of it.'

  return standing.said === 'still to split' ? (
    <>
      <Figure>{formatPaisa(standing.paisa)}</Figure> of it is still to split.
    </>
  ) : (
    <>
      That is <Figure>{formatPaisa(standing.paisa)}</Figure> more than the amount above.
    </>
  )
}

export function HowItWasPaid({
  label,
  parts,
  total,
  accounts,
  bankLabel,
  bankPlaceholder,
  onChange,
  onAddAccount,
}: {
  label: string
  parts: Array<Part>
  /** The whole figure, which one part takes all of. */
  total: string
  accounts: Array<Account>
  /** What the account is called on this screen: money leaves one and lands in another. */
  bankLabel: string
  /** What the account picker says when there is nothing chosen. Handed in because one screen tells three kinds of nothing apart -- a list still on its way, a list that did not load, and a partnership that banks nowhere. */
  bankPlaceholder?: string
  onChange: (parts: Array<Part>) => void
  onAddAccount?: (label: string, lastFourDigits: string) => Promise<string>
}) {
  const split = parts.length > 1
  const standing = howItStands(total, parts)

  function changePart(at: number, over: Partial<Part>) {
    onChange(parts.map((part, index) => (index === at ? { ...part, ...over } : part)))
  }

  return (
    <div className="flex flex-col gap-4">
      {parts.map((part, at) => (
        <div
          key={at}
          className={cn('flex flex-col gap-4', split && 'border-border border-l-2 pl-4')}
          data-part={String(at)}
        >
          {/* `Choices` rather than `Field`: a label points at one control, and the first button inside one takes the label's words as its own name -- so "Cheque" announced itself as "How paid How paid" and could be found by nothing, screen reader included. */}
          <Choices label={split ? `${label}, part ${String(at + 1)}` : label}>
            <div className="grid grid-cols-4 gap-2">
              {HOW_PAID.map((how) => (
                <button
                  key={how}
                  type="button"
                  role="radio"
                  aria-checked={part.method === how}
                  onClick={() => changePart(at, { method: how })}
                  className={cn(
                    'rounded-md border py-2.5 text-sm transition-colors',
                    part.method === how
                      ? 'border-primary bg-accent text-accent-foreground font-medium'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {SAID[how]}
                </button>
              ))}
            </div>
          </Choices>

          {/* Only once it is split. One way of paying takes the whole amount, and a box asking for a figure already on the screen is a box he has to agree with himself in. */}
          {split ? (
            <Field label={`How much of it, part ${String(at + 1)}`}>
              <Line
                value={part.amount}
                // Grouped as it is typed, the same as the figure above it. Without this the whole amount reads `300,000` and its parts read `200000` -- two ways of writing money on one screen, and the parts are the half he is checking against the total.
                onChange={(event) => changePart(at, { amount: groupWhileTyping(event.target.value) })}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-label={`How much of it, part ${String(at + 1)}`}
              />
            </Field>
          ) : null}

          {asksForChequeNumber(part.method) ? (
            <Field label={split ? `Cheque number, part ${String(at + 1)}` : 'Cheque number'}>
              <Line
                value={part.reference}
                onChange={(event) => changePart(at, { reference: event.target.value })}
                inputMode="numeric"
                autoComplete="off"
                aria-label={split ? `Cheque number, part ${String(at + 1)}` : 'Cheque number'}
              />
            </Field>
          ) : null}

          {asksForBank(part.method) ? (
            <PickAnAccount
              label={split ? `${bankLabel}, part ${String(at + 1)}` : bankLabel}
              placeholder={bankPlaceholder}
              chosen={asChoices(accounts).find((account) => account._id === part.bankAccountId) ?? null}
              accounts={accounts}
              // Looked up in the list it was drawn from rather than trusted, the same as every other picked answer in this app: what a picker hands back is plain text, and nothing unknown gets through.
              onPick={(picked) =>
                changePart(at, {
                  bankAccountId: picked === null ? '' : (accounts.find((one) => one._id === picked._id)?._id ?? ''),
                })
              }
              onAdd={onAddAccount}
            />
          ) : null}

          {/* Only where there is another part to be left standing. Taking the last one out would leave a payment settled no way at all. */}
          {split ? (
            <WayOut
              className="self-start"
              aria-label={`Take out part ${String(at + 1)}`}
              onClick={() => onChange(parts.filter((_, index) => index !== at))}
            >
              Take this part out
            </WayOut>
          ) : null}
        </div>
      ))}

      {/* The arithmetic while he types, never a refusal at the end. */}
      {standing === null ? null : (
        <p className="text-muted-foreground text-sm" role="status">
          <WhereTheSplitHasGot standing={standing} />
        </p>
      )}

      {/* This shipped as a bare `<button>` at `text-sm` with no padding at all -- a tap target the height of its own text, about 20px, opening the primary new thing on the day sheet. It merged under 997 passing tests, hours after every button in the app became shadcn's underneath, because nothing made a call site use one. */}
      <Button
        look="another"
        className="self-start"
        onClick={() => onChange([...parts, onePart(parts.some((part) => part.method === 'cash') ? 'cheque' : 'cash')])}
      >
        {split ? 'Add another way' : 'Pay it more than one way'}
      </Button>
    </div>
  )
}
