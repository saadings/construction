import { useState } from 'react'
import { asAWeekday } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'
import { whatIsWrongWith } from '~shared/validation/payment'

import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '../form/Button'
import { Day } from '../form/Day'
import { Field, Lines } from '../form/Field'
import { HowItWasPaid } from '../form/HowItWasPaid'
import { PickATrade } from '../form/PickATrade'
import { StillSending } from '../form/StillSending'
import { WayOut } from '../form/WayOut'
import { useWhatWasAdded } from '../form/whatWasAdded'
import { Figure } from '../shell/Page'
import { Trail } from '../shell/Trail'
import { MoneyLine } from './MoneyLine'
import { WhoWasPaid } from './WhoWasPaid'
import type { Draft } from './sitting'
import { anEmptyDraft, asTyped, paisaIn, pickedFrom, sittingTotalPaisa, whatIsMissingFromTheLine } from './sitting'
import { useKeepingIt, useTheSittingKept } from './theSittingKept'

export type Named = { _id: Draft['tradeId'] & string; name: string }
export type Person = { _id: Draft['paidToId'] & string; name: string }
export type Account = { _id: Id<'bankAccounts'>; label: string }

export type DaySheetProps = {
  siteName: string
  day: string
  onChangeDay: (day: string) => void
  trades: Array<Named>
  people: Array<Person>
  accounts: Array<Account>
  saving: boolean
  refusal: string | null
  // Answers whether the sitting went in, because what is kept on the device may only be forgotten when it has. A refusal leaves it exactly where it was.
  onPutIn: (drafts: Array<Draft>) => Promise<boolean>
  onAddAccount: (label: string, lastFourDigits: string) => Promise<Account['_id']>
  onAddTrade: (trade: { name: string; countsAsBuildingCost: boolean }) => Promise<Named['_id']>
  /** Where this sitting is kept while it is being typed: the house and the day, so another house never shows this one's half-typed payment. Left out only where there is nowhere to keep it, which is the gallery. */
  keptUnder?: string
}

/** What a line already put down is worth, or the words he typed when that cannot be read. Never a zero standing in for either. */
function whatItSays(draft: Draft): string {
  const paisa = paisaIn(draft)

  return paisa === null ? draft.amount : formatPaisa(paisa)
}

function nameOf(rows: Array<{ _id: string; name: string }>, id: string): string | undefined {
  return rows.find((row) => row._id === id)?.name
}

export function DaySheet({
  siteName,
  day,
  onChangeDay,
  trades,
  people,
  accounts,
  saving,
  refusal,
  onPutIn,
  onAddAccount,
  onAddTrade,
  keptUnder,
}: DaySheetProps) {
  // The lists as read, plus anything added from a picker since this sheet opened. A row created mid-sitting is not in the query's answer yet, and every picked id here is checked against the list it was drawn from -- so without this the field goes blank the moment it is added.
  const everyTrade = useWhatWasAdded(trades)
  const everyAccount = useWhatWasAdded(accounts)

  // A sitting is eight payments typed standing on a site. It lived in React state alone: the phone locks, iOS discards the tab, and the ledger loses the thing it exists to record without ever having said so.
  const kept = useTheSittingKept(keptUnder ?? '')

  const [done, setDone] = useState<Array<Draft>>(kept.restored?.done ?? [])
  const [draft, setDraft] = useState<Draft>(kept.restored?.draft ?? anEmptyDraft())
  const [problem, setProblem] = useState<string | null>(null)

  // Said once, until he sends. Restored and sent must not look the same: eight rows on a screen he has just reopened say nothing about whether they are in the ledger, and that is a worse lie than losing them.
  const [pickedUp, setPickedUp] = useState(kept.restored !== null)

  useKeepingIt(keptUnder ?? '', { done, draft }, keptUnder !== undefined)

  const runningTotal = sittingTotalPaisa([...done, draft])
  const change = (part: Partial<Draft>) => setDraft((was) => ({ ...was, ...part }))

  function keepAndStartAnother() {
    const missing = whatIsMissingFromTheLine(draft)
    if (missing) {
      setProblem(missing)
      return
    }

    setDone((was) => [...was, draft])
    // What carries from one payment to the next in a real cheque run: the ways it was paid, emptied of their figures, which is the same account and the same cheque book.
    setDraft(
      anEmptyDraft({
        parts: draft.parts.map((part) => ({ ...part, amount: '', reference: '' })),
      })
    )
    setProblem(null)
  }

  function takeOut(index: number) {
    setDone((was) => was.filter((_, at) => at !== index))
    // A sitting that is empty again is not a sitting with a problem in it.
    setProblem(null)
  }

  async function putThemIn() {
    // Anything typed at all, rather than a figure that came out above zero: a line whose amount cannot be read is a line he has started, and treating it as untouched sent the sitting in without it.
    const started = draft.amount.trim() !== '' || draft.tradeId !== ''
    if (started) {
      const missing = whatIsMissingFromTheLine(draft)
      if (missing) {
        setProblem(missing)
        return
      }
    }

    const all = started ? [...done, draft] : done
    if (all.length === 0) {
      setProblem('Put in a payment first.')
      return
    }

    // Forgotten the moment it is in, and not before. What is kept here is money-shaped -- who was paid and how much -- on a device he shares, so it lives exactly as long as the sitting does.
    if (await onPutIn(all)) {
      kept.forget()
      setPickedUp(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Asked for rather than inherited: this screen draws its own layout instead of sitting in a `Page`, because a sticky header over a form wants its padding inside each rather than around both. So the one thing `Page` would have given it has to be requested here, where forgetting it would be visible. */}

      {/* Above the sticky header rather than inside it, which is the one thing that makes the heading below not a duplicate. Put in with the header it was pinned too, so `1-A, Phase 0` sat on the screen twice, thirty-three pixels apart, permanently -- on the screen he uses most. A trail is navigation and scrolls away like it does on every other screen; the header is what somebody needs in front of them while typing, so the house, the day and the running total stay. */}
      <div className="px-5 pt-4 sm:px-7 lg:px-9">
        <Trail named={{ siteId: siteName }} />
      </div>

      <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="flex flex-col gap-3 px-5 pt-4 pb-4 sm:px-7 lg:px-9">
          {/* The house is the heading here: this screen has no `Page` and no title, so taking it out left nothing saying what the day sheet was. It is not a duplicate of the trail once the trail is not pinned beside it. */}
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-foreground truncate text-[0.9375rem] font-medium">{siteName}</p>
            {/* The control this app draws, rather than the OS one. In a CI picture it read `07/04/2026` beside `Sat 4 Jul` fifteen pixels below: the native control prints the browser's locale, which was July 4 in American order, and this app writes a day the other way round. Two dates from one variable, disagreeing, on the screen where he records what money went out that day. */}
            <Day look="beside" label="Date" value={day} onPick={onChangeDay} />
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-[0.75rem] font-medium tracking-[0.08em] uppercase">
                This sitting
              </p>
              <Figure className="text-brass -mt-1 block text-[2.5rem] leading-none">
                {runningTotal.paisa === 0 ? '0' : formatPaisa(runningTotal.paisa)}
              </Figure>
            </div>
            <p className="text-muted-foreground pb-1 text-sm">
              {done.length === 0 ? asAWeekday(day) : `${done.length} put down · ${asAWeekday(day)}`}
            </p>
          </div>

          {/* Restored and sent must not look the same. Eight rows on a screen he has just reopened say nothing at all about whether they are in the ledger, and a sitting silently put back is a worse lie than a sitting lost -- he would send them again, or not send them at all, and both are wrong in a way nothing on the screen could correct. */}
          {pickedUp ? (
            <p className="text-brass text-sm" role="status">
              Picked up where you left off. None of this has gone in yet.
            </p>
          ) : null}

          {/* Said at the total rather than only under the box: the figure above it is what he watches while he types, and a line it could not read is a line missing from it -- `111,111,111,111` in the box and `0` here, with the reason thrown away in between. Under the row rather than inside its left half, because beside the figure it squeezed the day out of its corner and broke `Sat 4 Jul` over two lines. */}
          {runningTotal.unreadable > 0 ? (
            <p className="text-destructive text-sm" role="status">
              {runningTotal.unreadable === 1
                ? 'A figure here is not one this can add, so it is not in the total.'
                : `${String(runningTotal.unreadable)} figures here are not ones this can add, so they are not in the total.`}
            </p>
          ) : null}
        </div>
      </header>

      {/* Beside the form at a desk, above it on a phone: the width is there, and a sitting is read against what is already in it. */}
      <main className="flex flex-col gap-7 px-5 py-6 sm:px-7 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start lg:gap-12 lg:px-9">
        <section className="flex flex-col gap-6 lg:order-2">
          <p className="text-faint hidden text-[0.75rem] tracking-[0.06em] uppercase lg:block">This sitting</p>
          {done.length > 0 ? (
            <ol className="border-border divide-hairline divide-y border-b lg:border-t">
              {done.map((each, index) => (
                <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-[0.9375rem]">
                      {nameOf(everyTrade.everything, each.tradeId) ?? 'Something else'}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {nameOf(people, each.paidToId) ?? each.newPerson}
                    </p>
                  </div>
                  <Figure className="text-brass shrink-0 text-lg">{whatItSays(each)}</Figure>

                  {/* Nothing here has gone in yet, so this takes a row back out of the sitting rather than out of the ledger. Without it a figure typed wrong five payments ago can only be fixed by putting the whole sitting in wrong and taking one out afterwards. */}
                  <WayOut
                    onClick={() => takeOut(index)}
                    aria-label={`Remove ${whatItSays(each)} to ${nameOf(people, each.paidToId) ?? each.newPerson}`}
                    className="shrink-0"
                  >
                    Remove
                  </WayOut>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground hidden text-sm lg:block">Nothing put down yet.</p>
          )}
        </section>

        <section className="flex w-full max-w-2xl flex-col gap-6 lg:order-1">
          <PickATrade
            label="Trade"
            problem={whatIsWrongWith('trade', asTyped(draft, draft.parts[0]))}
            placeholder="Pick one"
            chosen={everyTrade.everything.find((trade) => trade._id === draft.tradeId) ?? null}
            trades={everyTrade.everything}
            onPick={(picked) => {
              change({ tradeId: picked === null ? '' : everyTrade.pickedFromThese(picked._id) })
            }}
            onAdd={async (trade) => {
              const _id = await onAddTrade(trade)
              everyTrade.remember({ _id, name: trade.name })

              return _id
            }}
          />

          <WhoWasPaid
            who={{ paidToId: draft.paidToId, newPerson: draft.newPerson }}
            people={people}
            problem={whatIsWrongWith('paidTo', asTyped(draft, draft.parts[0]))}
            onChange={(who) => {
              // Looked up in the list it was drawn from rather than trusted, the same as every other picked answer here.
              change({ paidToId: pickedFrom(people, who.paidToId), newPerson: who.newPerson })
            }}
          />

          <MoneyLine
            value={draft.amount}
            onChange={(amount) => change({ amount })}
            problem={whatIsWrongWith('amount', asTyped(draft, draft.parts[0], draft.amount))}
          />

          {/* Every way this one payment was settled. He asked to split between cash and cheques, and chose separate rows: what he types once -- the trade, the person, the amount, the day -- is shared, and each way of paying carries its own cheque number or account. */}
          <HowItWasPaid
            label="Payment method"
            parts={draft.parts}
            total={draft.amount}
            accounts={everyAccount.everything}
            bankLabel="Account"
            onChange={(parts) => change({ parts })}
            onAddAccount={async (label, lastFourDigits) => {
              const _id = await onAddAccount(label, lastFourDigits)
              everyAccount.remember({ _id, label })

              return _id
            }}
          />

          <Field label="Note">
            <Lines
              value={draft.note}
              onChange={(event) => change({ note: event.target.value })}
              placeholder="Notes"
              aria-label="Note"
            />
          </Field>
        </section>
      </main>

      {/* At the foot of the screen at every width. It used to sit a bar's height up on a phone; the bar went with the shell, and there is nothing under it now to clear. */}

      {/* Pinned here and deliberately not on `ComingIn`, which puts the same kind of button at the foot of its form. A sitting is twenty payments and these two are pressed twenty times, so the tenth of the screen this costs is paid back on every one of them. A receipt is entered once, where the same cost would be paid on all seven of its questions to save a single scroll. */}
      <footer className="border-border bg-background/95 sticky bottom-0 z-10 border-t backdrop-blur-sm">
        <div className="flex flex-col gap-2 px-5 pt-3 pb-5 sm:px-7 lg:px-9">
          <StillSending busy={saving} keeps={keptUnder !== undefined} />
          {(problem ?? refusal) ? (
            <p className="text-destructive text-sm" role="alert">
              {problem ?? refusal}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button look="beside" onClick={keepAndStartAnother} disabled={saving} className="flex-1">
              Add another
            </Button>
            <Button onClick={() => void putThemIn()} busy={saving} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
