import { useState } from 'react'
import { whatIsWrong } from '~shared/validation/primitives'
import { tradeName } from '~shared/validation/trade'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'
import { Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

// The list a day sheet picks from, named after the field that picks from it. Nauman was looking straight at `WHAT FOR` on the day sheet and could not find where the list came from -- it was called "what money is spent on", which is a true description and not the words in front of him.

export type TradeRow = { _id: string; name: string; countsAsBuildingCost: boolean }
export type NewTrade = { name: string; countsAsBuildingCost: boolean }

// The words he uses, not the field name. `countsAsBuildingCost` decides what a house cost: buying the land is money spent and is not building.
const BUILDING = 'Part of what the house cost'
const NOT_BUILDING = 'Land, taxes and commission'

export function Trades({
  trades,
  onAdd,
  onEdit,
  onTakeOff,
}: {
  trades: Array<TradeRow> | null | undefined
  onAdd: (trade: NewTrade) => Promise<void>
  onEdit: (tradeId: string, trade: NewTrade) => Promise<void>
  onTakeOff: (tradeId: string) => Promise<void>
}) {
  // Closed until asked for. The form used to sit above the list, so forty-seven things he has were below a box for one he has not.
  const [adding, setAdding] = useState(false)

  return (
    <Page
      title="What for"
      beside={
        adding ? null : (
          <Button className="py-2 text-sm" onClick={() => setAdding(true)}>
            Add one
          </Button>
        )
      }
    >
      <p className="text-muted-foreground max-w-prose text-sm">
        The list a day sheet picks from. Money spent on the first group is part of what the house cost; the second is
        what the ground under it cost.
      </p>

      {adding ? <AddATrade onAdd={onAdd} onDone={() => setAdding(false)} /> : null}

      {trades === undefined ? (
        <WhileWaiting what="Getting what a day sheet picks from">
          <div className="divide-hairline flex flex-col divide-y">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 py-3">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </WhileWaiting>
      ) : trades === null ? (
        <p className="text-muted text-sm">The list did not come back. Sign out and in again.</p>
      ) : (
        <TwoSides trades={trades} onEdit={onEdit} onTakeOff={onTakeOff} />
      )}
    </Page>
  )
}

// Grouped by side rather than a mark on every row. Three of forty-seven are not building cost, and that is where a wrong one hides: to find it on a marked list you read all forty-seven, and here you read three.
function TwoSides({
  trades,
  onEdit,
  onTakeOff,
}: {
  trades: Array<TradeRow>
  onEdit: (tradeId: string, trade: NewTrade) => Promise<void>
  onTakeOff: (tradeId: string) => Promise<void>
}) {
  const sides = [
    { said: BUILDING, on: trades.filter((trade) => trade.countsAsBuildingCost) },
    { said: NOT_BUILDING, on: trades.filter((trade) => !trade.countsAsBuildingCost) },
  ]

  if (trades.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">Nothing on the list yet.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {sides.map((side) => (
        <section key={side.said} className="flex flex-col gap-1">
          {/* The count is beside the heading because it is the answer to "how many are on the wrong side", which is the question he has about this list. */}
          <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">
            {side.said} · {side.on.length}
          </h2>

          {side.on.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">Nothing on this side.</p>
          ) : (
            <ul aria-label={side.said} className="divide-hairline flex flex-col divide-y">
              {side.on.map((trade) => (
                <OneTrade key={trade._id} trade={trade} onEdit={onEdit} onTakeOff={onTakeOff} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

function OneTrade({
  trade,
  onEdit,
  onTakeOff,
}: {
  trade: TradeRow
  onEdit: (tradeId: string, trade: NewTrade) => Promise<void>
  onTakeOff: (tradeId: string) => Promise<void>
}) {
  const [changing, setChanging] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  // Kept while the row is open so a refusal does not empty what he was correcting.
  const [name, setName] = useState(trade.name)
  const [building, setBuilding] = useState(trade.countsAsBuildingCost)
  const [saving, setSaving] = useState(false)

  async function send(what: () => Promise<void>) {
    setSaving(true)
    setRefusal(null)

    try {
      await what()
      setChanging(false)
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  if (!changing) {
    return (
      <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
        {/* Which side it is on is the heading above it now, so the row carries the name and the way to change it and nothing else. */}
        <span className="text-foreground">{trade.name}</span>
        <button
          type="button"
          onClick={() => {
            setChanging(true)
          }}
          className="text-primary shrink-0 text-sm font-medium"
        >
          Change
        </button>
        {refusal === null ? null : (
          <span role="alert" className="text-destructive w-full text-sm">
            {refusal}
          </span>
        )}
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <Field label="What it is" problem={whatIsWrong(tradeName, name)}>
        <Line
          value={name}
          onChange={(event) => {
            setName(event.target.value)
          }}
          autoComplete="off"
          aria-label={`What ${trade.name} is`}
        />
      </Field>

      <WhatItIsFor
        building={building}
        onChange={setBuilding}
        label={`Whether ${trade.name} is part of what the house cost`}
      />

      {refusal === null ? null : (
        <span role="alert" className="text-destructive text-sm">
          {refusal}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          busy={saving}
          className="py-2 text-sm"
          onClick={() => send(async () => await onEdit(trade._id, { name, countsAsBuildingCost: building }))}
        >
          Save it
        </Button>
        <button
          type="button"
          onClick={() => {
            setName(trade.name)
            setBuilding(trade.countsAsBuildingCost)
            setChanging(false)
          }}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          Never mind
        </button>
        {/* Hidden, never deleted: payments point at a trade forever, and one that vanishes turns spent money into money spent on nothing. */}
        <button
          type="button"
          onClick={() => send(async () => await onTakeOff(trade._id))}
          className="text-destructive ml-auto text-sm"
        >
          Take it off the list
        </button>
      </div>
    </li>
  )
}

function AddATrade({ onAdd, onDone }: { onAdd: (trade: NewTrade) => Promise<void>; onDone: () => void }) {
  const [name, setName] = useState('')
  const [building, setBuilding] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function add() {
    setSaving(true)
    setRefusal(null)

    try {
      await onAdd({ name, countsAsBuildingCost: building })
      onDone()
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-border flex w-full max-w-2xl flex-col gap-4 rounded-md border p-4">
      <Field label="Something else it is spent on" problem={whatIsWrong(tradeName, name)}>
        <Line
          value={name}
          onChange={(event) => {
            setName(event.target.value)
          }}
          autoComplete="off"
          placeholder="Scaffolding"
          aria-label="Something else it is spent on"
        />
      </Field>

      <WhatItIsFor building={building} onChange={setBuilding} label="Whether it is part of what the house cost" />

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={add} busy={saving} className="py-2 text-sm">
          Put it on the list
        </Button>
        <button type="button" onClick={onDone} className="text-muted-foreground text-sm underline underline-offset-4">
          Never mind
        </button>
      </div>
    </div>
  )
}

// Two named choices rather than a tick nobody can read. "Counts as building cost" is the field; what he is being asked is whether the house cost this or whether the land did.
function WhatItIsFor({
  building,
  onChange,
  label,
}: {
  building: boolean
  onChange: (building: boolean) => void
  label: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
      {[
        { is: true, said: BUILDING },
        { is: false, said: NOT_BUILDING },
      ].map((choice) => (
        <button
          key={choice.said}
          type="button"
          role="radio"
          aria-checked={building === choice.is}
          onClick={() => {
            onChange(choice.is)
          }}
          className={
            building === choice.is
              ? 'border-primary bg-accent text-accent-foreground rounded-md border py-2 text-sm font-medium'
              : 'border-border text-muted-foreground rounded-md border py-2 text-sm'
          }
        >
          {choice.said}
        </button>
      ))}
    </div>
  )
}
