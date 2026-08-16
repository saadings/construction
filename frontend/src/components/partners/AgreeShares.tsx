import type { ReactNode } from 'react'
import { useState } from 'react'
import { formatPaisa } from '~shared/money'
import { percentAsBasisPoints, saySharesDoNotAddUp, shortOfTheWhole } from '~shared/validation/profitShare'

import { Button } from '../form/Button'
import { Field, Line, useSaidOnceLeft } from '../form/Field'
import { Pick } from '../form/Pick'
import { WayOut } from '../form/WayOut'
import { Figure, Form, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import type { Position, WhatThePartnersHave } from './Positions'

export type Somebody = { _id: string; name: string }

export type AgreedShare = { personId: string; share: string }

// Basis points read back as the percentage somebody said out loud: 3333 is 33.33, and 7500 is 75 rather than 75.00.
function asTyped(basisPoints: number): string {
  return String(Math.round(basisPoints) / 100)
}

// What is in one box, read by the same rule the server refuses by, so a share the screen adds up is a share the server adds up.
function inBasisPoints(typed: string): number | null {
  const read = percentAsBasisPoints.safeParse(typed)

  return read.success ? read.data : null
}

// The same markup at every width: a phone gets the name and the box, a desk gets what he put in and the way out as well.
const ROW =
  'grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6.5rem_5rem]'

// Handed the same reading the house page shows, rather than a slice of it: the route passes what came back and this decides what to draw, so the three states are answered in one place instead of two disagreeing.
export function AgreeShares({
  siteName,
  what,
  everybody,
  saving,
  refusal,
  onAgree,
  onFollowTheMoney,
  beneath,
}: {
  siteName: string
  // As it came. `undefined` is a reading on its way; `null` is a house that is not there.
  what: WhatThePartnersHave | null | undefined
  everybody: Array<Somebody> | null | undefined
  saving: boolean
  refusal: string | null
  onAgree: (agreedOn: string, shares: Array<AgreedShare>) => Promise<boolean>
  onFollowTheMoney: () => Promise<boolean>
  // What has actually gone back to them, under the shares that decide how much would. Handed in rather than built here for the same reason the links are: this stays a thing that asks about shares, and the page around it keeps knowing what else is on it.

  // Asked for with the reading rather than handed over as a finished element, because what goes underneath is about the same partners this form is about. A plain node has to be built before this component decides whether the reading arrived, so the page around it ends up writing `what?.positions ?? []` -- which is a house still loading and a house with no partners in it, told apart nowhere.
  beneath?: (what: WhatThePartnersHave) => ReactNode
}) {
  return (
    <Page title="What each partner takes" beside={<span className="text-muted-foreground text-sm">{siteName}</span>}>
      {what === undefined ? (
        <SharesWaiting />
      ) : what === null ? null : (
        <>
          <Setting
            siteName={siteName}
            partners={what.positions}
            everybody={everybody ?? []}
            sharesAgreed={what.sharesAgreed}
            saving={saving}
            refusal={refusal}
            onAgree={onAgree}
            onFollowTheMoney={onFollowTheMoney}
          />

          {beneath?.(what)}
        </>
      )}
    </Page>
  )
}

type Row = { personId: string; name: string; capitalPaisa: number; typed: string }

function Setting({
  siteName,
  partners,
  everybody,
  sharesAgreed,
  saving,
  refusal,
  onAgree,
  onFollowTheMoney,
}: {
  siteName: string
  partners: Array<Position>
  everybody: Array<Somebody>
  sharesAgreed: boolean
  saving: boolean
  refusal: string | null
  onAgree: (agreedOn: string, shares: Array<AgreedShare>) => Promise<boolean>
  onFollowTheMoney: () => Promise<boolean>
}) {
  // Seeded from what the house reads as today -- the agreed shares if there are any, and otherwise what each of them put in. So the first thing on the screen is what is true now, and a change is a change to that rather than an empty table to fill in from memory.
  const [rows, setRows] = useState<Array<Row>>(() =>
    partners.map((partner) => ({
      personId: partner.personId,
      name: partner.name,
      capitalPaisa: partner.capitalPaisa,
      typed: asTyped(partner.basisPoints),
    }))
  )
  const [agreedOn, setAgreedOn] = useState(() => new Date().toISOString().slice(0, 10))

  const short = shortOfTheWhole(rows.map((row) => ({ share: inBasisPoints(row.typed) ?? 0 })))
  const notYetIn = everybody.filter((person) => !rows.some((row) => row.personId === person._id))

  function change(personId: string, typed: string) {
    setRows((was) => was.map((row) => (row.personId === personId ? { ...row, typed } : row)))
  }

  function takeOut(personId: string) {
    setRows((was) => was.filter((row) => row.personId !== personId))
  }

  // Somebody taking a share who has put nothing into this house. Nauman's own case: who funded a house and who agreed to take the profit are not always the same people.
  function put(personId: string) {
    const person = everybody.find((one) => one._id === personId)

    if (person === undefined || rows.some((row) => row.personId === personId)) return

    setRows((was) => [...was, { personId, name: person.name, capitalPaisa: 0, typed: '' }])
  }

  return (
    <Form>
      <p className="text-muted-foreground max-w-prose text-sm">
        {sharesAgreed
          ? 'These are what they agreed between them. Change any of them and agree it again.'
          : 'These follow what each of them has put in. Put your own figures in to agree something else.'}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          Nobody has put money into this house yet. Add whoever is taking a share, or put a partner’s money in first.
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
          >
            <span>Partner</span>
            <span className="text-right">Put in</span>
            <span className="text-right">Share</span>
            <span />
          </div>

          <ul className="divide-hairline flex flex-col divide-y">
            {rows.map((row) => (
              <Share key={row.personId} row={row} onChange={change} onTakeOut={takeOut} />
            ))}
          </ul>
        </div>
      )}

      <AddsUp short={short} siteName={siteName} />

      {notYetIn.length === 0 ? null : (
        <Pick
          label="Somebody else takes a share"
          hint="Anybody taking a share without having put money in."
          placeholder="Pick one"
          chosen={null}
          choices={notYetIn}
          onPick={(picked) => {
            if (picked !== null) put(picked._id)
          }}
        />
      )}

      <Field label="Agreed on">
        <Line
          value={agreedOn}
          onChange={(event) => setAgreedOn(event.target.value)}
          type="date"
          aria-label="Agreed on"
        />
      </Field>

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            void onAgree(
              agreedOn,
              rows.map((row) => ({ personId: row.personId, share: row.typed }))
            )
          }}
          busy={saving}
        >
          Agree these shares
        </Button>

        {/* Only where there is something to go back from: a house already following the money has nowhere to go. */}
        {sharesAgreed ? (
          <Button
            look="beside"
            onClick={() => {
              void onFollowTheMoney()
            }}
            busy={saving}
          >
            Go back to what they put in
          </Button>
        ) : null}
      </div>
    </Form>
  )
}

function Share({
  row,
  onChange,
  onTakeOut,
}: {
  row: Row
  onChange: (personId: string, typed: string) => void
  onTakeOut: (personId: string) => void
}) {
  const wrong = whatIsWrongWithAShare(row.typed)
  // The same rule the rest of the app holds to: nothing is said about a box while somebody is still typing in it.
  const { showing, onBlur } = useSaidOnceLeft(wrong)
  const said = `${row.personId}-wrong`

  return (
    <li className={`${ROW} py-3`}>
      <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{row.name}</span>

      {/* What he put in, beside his share, because a share is agreed against it even where it does not follow it. */}

      {/* On a phone it goes on the second line with the way out beside it, rather than last with the way out floating above it. Ordered rather than reordered in the markup, because at desk width these are four columns in the order the heading names them. */}
      <span className="text-muted-foreground order-3 text-sm sm:order-none sm:text-right">
        <span className="sm:hidden">Put in </span>
        <Figure>{formatPaisa(row.capitalPaisa)}</Figure>
      </span>

      <span className="order-2 flex items-baseline gap-1 sm:order-none">
        <Line
          value={row.typed}
          onChange={(event) => onChange(row.personId, event.target.value)}
          onBlur={onBlur}
          inputMode="decimal"
          aria-label={`${row.name}’s share`}
          aria-invalid={showing || undefined}
          aria-describedby={showing ? said : undefined}
          placeholder="0"
          className="text-right"
        />
        <span className="text-muted-foreground text-sm">%</span>
      </span>

      {/* Underlined, because an underline is an affordance and grey text is not. Without it this was text with no border and no underline, on its own line between a share and a figure, where it read as the caption for the figure under it rather than as something to press. */}

      {/* Not because the app had settled on it: of nine ways out, four are underlined like this one -- a receipt out of what has come in, a payout taken back, an invitation off the list -- four are plain text, and one is red. There is no answer here to copy, so copy the reason instead. Picking one and converting all nine waits on the table sweep reaching the two that remove real rows. */}
      <WayOut
        onClick={() => onTakeOut(row.personId)}
        aria-label={`Take ${row.name} out of the shares`}
        className="order-4 justify-self-end sm:order-none"
      >
        Take out
      </WayOut>

      {showing ? (
        <span id={said} role="alert" className="text-destructive col-span-2 text-sm sm:col-span-4 sm:text-right">
          {wrong}
        </span>
      ) : null}
    </li>
  )
}

// Read here rather than through `whatIsWrong`, because an empty box on this screen is a row somebody has not finished rather than one they have got wrong, and the rule's own words for it are about a figure that was typed.
function whatIsWrongWithAShare(typed: string): string | null {
  if (typed.trim() === '') return null

  const read = percentAsBasisPoints.safeParse(typed)

  return read.success ? null : (read.error.issues[0]?.message ?? 'Put in a share, like 33.33.')
}

// What they come to, said while it is being typed rather than only when it is refused. The sentence is the server's own, so the screen and the refusal cannot say two different things about one rule.
function AddsUp({ short, siteName }: { short: number; siteName: string }) {
  if (short === 0) {
    return (
      <p className="text-green text-sm" role="status">
        These come to the whole.
      </p>
    )
  }

  return (
    <p className="text-muted-foreground text-sm" role="status">
      {saySharesDoNotAddUp(siteName, short)}
    </p>
  )
}

// The shape of what is coming: a name and a box for the share, twice over.
function SharesWaiting() {
  return (
    <WhileWaiting what="Getting who takes what">
      <div className="divide-hairline flex flex-col divide-y">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between gap-4 py-3.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
