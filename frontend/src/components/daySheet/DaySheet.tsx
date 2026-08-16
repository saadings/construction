import { useState } from 'react'
import { formatPaisa } from '~shared/money'
import { whatIsWrongWith } from '~shared/validation/payment'

import { cn } from '../../lib/utils'
import { Button } from '../form/Button'
import { Choices, Field, Line, Lines } from '../form/Field'
import { Pick, asChoices } from '../form/Pick'
import { Figure } from '../shell/Page'
import { AddAnAccount } from './AddAnAccount'
import { MoneyLine } from './MoneyLine'
import { WhoWasPaid } from './WhoWasPaid'
import type { Draft } from './sitting'
import {
  HOW_PAID,
  anEmptyDraft,
  asksForBank,
  asksForChequeNumber,
  paisaIn,
  pickedFrom,
  sittingTotalPaisa,
  whatIsMissing,
} from './sitting'

export type Named = { _id: Draft['tradeId'] & string; name: string }
export type Person = { _id: Draft['paidToId'] & string; name: string }
export type Account = { _id: Draft['bankAccountId'] & string; label: string }

export type DaySheetProps = {
  siteName: string
  day: string
  onChangeDay: (day: string) => void
  trades: Array<Named>
  people: Array<Person>
  accounts: Array<Account>
  saving: boolean
  refusal: string | null
  onPutIn: (drafts: Array<Draft>) => void
  onAddAccount: (label: string, lastFourDigits: string) => Promise<Account['_id']>
}

function niceDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return day

  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
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
}: DaySheetProps) {
  const [done, setDone] = useState<Array<Draft>>([])
  const [draft, setDraft] = useState<Draft>(anEmptyDraft())
  const [problem, setProblem] = useState<string | null>(null)

  const runningTotal = sittingTotalPaisa([...done, draft])
  const change = (part: Partial<Draft>) => setDraft((was) => ({ ...was, ...part }))

  function keepAndStartAnother() {
    const missing = whatIsMissing(draft)
    if (missing) {
      setProblem(missing)
      return
    }

    setDone((was) => [...was, draft])
    // What carries from one payment to the next in a real cheque run: the same account, the same money, the same person more often than not.
    setDraft(
      anEmptyDraft({
        method: draft.method,
        bankAccountId: draft.bankAccountId,
      })
    )
    setProblem(null)
  }

  function takeOut(index: number) {
    setDone((was) => was.filter((_, at) => at !== index))
    // A sitting that is empty again is not a sitting with a problem in it.
    setProblem(null)
  }

  function putThemIn() {
    const started = paisaIn(draft) > 0 || draft.tradeId !== ''
    if (started) {
      const missing = whatIsMissing(draft)
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

    onPutIn(all)
  }

  return (
    <div className="flex flex-col">
      <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="flex flex-col gap-3 px-5 pt-4 pb-4 sm:px-7 lg:px-9">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-foreground truncate text-[0.9375rem] font-medium">{siteName}</p>
            {/* Named on the box rather than beside it: this sits in the header of a sitting, where an upper-case question over it would be a second heading. */}
            <Line
              look="beside"
              type="date"
              value={day}
              onChange={(event) => onChangeDay(event.target.value)}
              aria-label="Which day"
              className="text-muted-foreground w-auto shrink-0 text-right"
            />
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-[0.75rem] font-medium tracking-[0.08em] uppercase">
                This sitting
              </p>
              <Figure className="text-brass -mt-1 block text-[2.5rem] leading-none">
                {runningTotal === 0 ? '0' : formatPaisa(runningTotal)}
              </Figure>
            </div>
            <p className="text-muted-foreground pb-1 text-sm">
              {done.length === 0 ? niceDay(day) : `${done.length} put down · ${niceDay(day)}`}
            </p>
          </div>
        </div>
      </header>

      {/* Beside the form at a desk, above it on a phone: the width is there, and a sitting is read against what is already in it. */}
      <main className="flex flex-col gap-7 px-5 py-6 sm:px-7 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start lg:gap-12 lg:px-9">
        <section className="flex flex-col gap-6 lg:order-2">
          <p className="text-faint hidden text-[0.75rem] tracking-[0.06em] uppercase lg:block">In this sitting</p>
          {done.length > 0 ? (
            <ol className="border-border divide-hairline divide-y border-b lg:border-t">
              {done.map((each, index) => (
                <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-[0.9375rem]">
                      {nameOf(trades, each.tradeId) ?? 'Something else'}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {nameOf(people, each.paidToId) ?? each.newPerson}
                    </p>
                  </div>
                  <Figure className="text-brass shrink-0 text-lg">{formatPaisa(paisaIn(each))}</Figure>

                  {/* Nothing here has gone in yet, so this takes a row back out of the sitting rather than out of the ledger. Without it a figure typed wrong five payments ago can only be fixed by putting the whole sitting in wrong and taking one out afterwards. */}
                  <button
                    type="button"
                    onClick={() => takeOut(index)}
                    aria-label={`Take out ${formatPaisa(paisaIn(each))} to ${nameOf(people, each.paidToId) ?? each.newPerson}`}
                    className="text-muted-foreground shrink-0 text-sm"
                  >
                    Take out
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground hidden text-sm lg:block">Nothing put down yet.</p>
          )}
        </section>

        <section className="flex w-full max-w-2xl flex-col gap-6 lg:order-1">
          <Pick
            label="What for"
            problem={whatIsWrongWith('trade', draft)}
            placeholder="Pick one"
            chosen={trades.find((trade) => trade._id === draft.tradeId) ?? null}
            choices={trades}
            onPick={(picked) => {
              change({ tradeId: picked === null ? '' : pickedFrom(trades, picked._id) })
            }}
          />

          <WhoWasPaid
            who={{ paidToId: draft.paidToId, newPerson: draft.newPerson }}
            people={people}
            problem={whatIsWrongWith('paidTo', draft)}
            onChange={(who) => {
              // Looked up in the list it was drawn from rather than trusted, the same as every other picked answer here.
              change({ paidToId: pickedFrom(people, who.paidToId), newPerson: who.newPerson })
            }}
          />

          <MoneyLine
            value={draft.amount}
            onChange={(amount) => change({ amount })}
            problem={whatIsWrongWith('amount', draft)}
          />

          {/* `Choices` rather than `Field`: a label points at one control, and the first button inside one takes the label's words as its own name -- so "Cheque" announced itself as "How paid How paid" and could be found by nothing, screen reader included. */}
          <Choices label="How paid">
            <div className="grid grid-cols-4 gap-2">
              {HOW_PAID.map((how) => (
                <button
                  key={how.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.method === how.value}
                  onClick={() => change({ method: how.value })}
                  className={cn(
                    'rounded-md border py-2.5 text-sm transition-colors',
                    draft.method === how.value
                      ? 'border-primary bg-accent text-accent-foreground font-medium'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {how.label}
                </button>
              ))}
            </div>
          </Choices>

          {asksForChequeNumber(draft.method) ? (
            <Field label="Cheque number" problem={whatIsWrongWith('reference', draft)}>
              <Line
                value={draft.reference}
                onChange={(event) => change({ reference: event.target.value })}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Cheque number"
              />
            </Field>
          ) : null}

          {asksForBank(draft.method) ? (
            <>
              <Pick
                label="Which account"
                problem={whatIsWrongWith('bank', draft)}
                placeholder={accounts.length === 0 ? 'No accounts yet' : 'Pick one'}
                chosen={asChoices(accounts).find((account) => account._id === draft.bankAccountId) ?? null}
                choices={asChoices(accounts)}
                onPick={(picked) => {
                  change({ bankAccountId: picked === null ? '' : pickedFrom(accounts, picked._id) })
                }}
              />
              {/* Offered here rather than named somewhere else, so a half-typed sitting survives adding one. */}
              <AddAnAccount
                onAdd={async (label, lastFourDigits) => {
                  change({ bankAccountId: await onAddAccount(label, lastFourDigits) })
                }}
              />
            </>
          ) : null}

          <Field label="Note">
            <Lines
              value={draft.note}
              onChange={(event) => change({ note: event.target.value })}
              placeholder="Anything worth remembering"
              aria-label="Note"
            />
          </Field>
        </section>
      </main>

      {/* At the foot of the screen at every width. It used to sit a bar's height up on a phone; the bar went with the shell, and there is nothing under it now to clear. */}

      {/* Pinned here and deliberately not on `ComingIn`, which puts the same kind of button at the foot of its form. A sitting is twenty payments and these two are pressed twenty times, so the tenth of the screen this costs is paid back on every one of them. A receipt is entered once, where the same cost would be paid on all seven of its questions to save a single scroll. */}
      <footer className="border-border bg-background/95 sticky bottom-0 z-10 border-t backdrop-blur-sm">
        <div className="flex flex-col gap-2 px-5 pt-3 pb-5 sm:px-7 lg:px-9">
          {(problem ?? refusal) ? (
            <p className="text-destructive text-sm" role="alert">
              {problem ?? refusal}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button look="beside" onClick={keepAndStartAnother} disabled={saving} className="flex-1">
              Add another
            </Button>
            <Button onClick={putThemIn} busy={saving} className="flex-1">
              Put them in
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
