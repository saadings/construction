import { useState } from 'react'
import { formatPaisa } from '~shared/money'
import { whatIsWrongWith } from '~shared/validation/payment'

import { cn } from '../../lib/utils'
import { Button } from '../form/Button'
import { Field, Line, Lines, Picker } from '../form/Field'
import { Figure } from '../shell/Page'
import { AddAnAccount } from './AddAnAccount'
import { MoneyLine } from './MoneyLine'
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
        paidById: draft.paidById,
        method: draft.method,
        bankAccountId: draft.bankAccountId,
      })
    )
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
            <label className="text-muted-foreground shrink-0 text-sm">
              <span className="sr-only">Which day</span>
              <input
                type="date"
                value={day}
                onChange={(event) => onChangeDay(event.target.value)}
                className="bg-transparent text-right outline-none"
                aria-label="Which day"
              />
            </label>
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
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground hidden text-sm lg:block">Nothing put down yet.</p>
          )}
        </section>

        <section className="flex w-full max-w-2xl flex-col gap-6 lg:order-1">
          <Field label="What for" problem={whatIsWrongWith('trade', draft)}>
            <Picker
              value={draft.tradeId}
              onChange={(event) => change({ tradeId: pickedFrom(trades, event.target.value) })}
              aria-label="What for"
            >
              <option value="">Pick one</option>
              {trades.map((trade) => (
                <option key={trade._id} value={trade._id}>
                  {trade.name}
                </option>
              ))}
            </Picker>
          </Field>

          <Field
            label="Who was paid"
            hint={draft.paidToId ? undefined : 'Or type a name nobody will be paid again.'}
            problem={whatIsWrongWith('paidTo', draft)}
          >
            <Picker
              value={draft.paidToId}
              onChange={(event) => change({ paidToId: pickedFrom(people, event.target.value) })}
              aria-label="Who was paid"
            >
              <option value="">Pick one</option>
              {people.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </Picker>
          </Field>

          {draft.paidToId === '' ? (
            <Field label="Or a name">
              <Line
                value={draft.newPerson}
                onChange={(event) => change({ newPerson: event.target.value })}
                placeholder="Shop or person"
                aria-label="Or a name"
                autoComplete="off"
              />
            </Field>
          ) : null}

          <MoneyLine
            value={draft.amount}
            onChange={(amount) => change({ amount })}
            problem={whatIsWrongWith('amount', draft)}
          />

          <Field label="Whose money" problem={whatIsWrongWith('paidBy', draft)}>
            <Picker
              value={draft.paidById}
              onChange={(event) => change({ paidById: pickedFrom(people, event.target.value) })}
              aria-label="Whose money"
            >
              <option value="">Pick one</option>
              {people.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </Picker>
          </Field>

          <Field label="How paid">
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="How paid">
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
          </Field>

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
            <Field label="Which account" problem={whatIsWrongWith('bank', draft)}>
              <Picker
                value={draft.bankAccountId}
                onChange={(event) => change({ bankAccountId: pickedFrom(accounts, event.target.value) })}
                aria-label="Which account"
              >
                <option value="">{accounts.length === 0 ? 'No accounts yet' : 'Pick one'}</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.label}
                  </option>
                ))}
              </Picker>
              {/* Offered here rather than named somewhere else, so a half-typed sitting survives adding one. */}
              <AddAnAccount
                onAdd={async (label, lastFourDigits) => {
                  change({ bankAccountId: await onAddAccount(label, lastFourDigits) })
                }}
              />
            </Field>
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

      {/* Above the bar along the bottom of a phone rather than under it, and at the foot of the page everywhere else. */}
      <footer className="border-border bg-background/95 sticky bottom-[var(--phone-bar)] z-10 border-t backdrop-blur-sm sm:bottom-0">
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
