import { useState } from 'react'
import { todayOnThisDevice } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'
import { milestoneInput } from '~shared/validation/milestone'
import { percent as percentRule, whatIsWrong } from '~shared/validation/primitives'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'
import { whatWentWrong } from '../form/whatWentWrong'
import { Figure, Form } from '../shell/Page'
import { Table, TableBody, TableCell, TableRow } from '../ui/table'

// The stages a contract is billed in. Each is a percentage of the contract, so every figure here follows the contract and the measured area, and none of them is stored.

export type StageRow = {
  _id: string
  description: string
  percent: number
  amountPaisa: number
  billedOn?: string
}

export function Stages({
  stages,
  percentAgreed,
  onAdd,
  onBill,
}: {
  stages: Array<StageRow>
  percentAgreed: number
  onAdd: (stage: { description: string; percent: string }) => Promise<void>
  onBill: (milestoneId: string, billedOn: string) => Promise<void>
}) {
  return (
    <section className="flex flex-col gap-3">
      <Heading>Billed in stages</Heading>

      {stages.length === 0 ? (
        <p className="text-muted-foreground">
          No stages set out yet. Put in the first, and the figure against it follows.
        </p>
      ) : (
        // The size is set back because shadcn's table is `text-sm`, and a stage and the figure against it are what this screen is for.
        <Table className="min-w-[30rem] text-base">
          <TableBody>
            {stages.map((stage) => (
              <TableRow key={stage._id}>
                {/* A stage reads as it does on the contract and can run long, so it wraps rather than pushing the figure off the side. */}
                <TableCell className="text-foreground py-2.5 pr-4 whitespace-normal">{stage.description}</TableCell>
                <TableCell className="py-2.5 pr-4">
                  <Figure className="text-muted-foreground">{stage.percent}%</Figure>
                </TableCell>
                {/* Green is money owed to him. */}
                <TableCell className="py-2.5 pr-4 text-right">
                  <Figure className="text-green">{formatPaisa(stage.amountPaisa)}</Figure>
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  {stage.billedOn === undefined ? (
                    <BillIt stage={stage} onBill={onBill} />
                  ) : (
                    <span className="text-muted-foreground text-sm">Billed {stage.billedOn}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <WhatIsLeft percentAgreed={percentAgreed} />
      <AddAStage onAdd={onAdd} />
    </section>
  )
}

// Said rather than refused. A re-measurement or a stage nobody planned leaves real contracts adding to something other than a hundred, and refusing those would refuse the truth -- but nobody should have to add the column up to find out where they are.
function WhatIsLeft({ percentAgreed }: { percentAgreed: number }) {
  const left = Math.round((100 - percentAgreed) * 100) / 100

  if (left === 0) {
    return <p className="text-muted-foreground text-sm">The stages come to the whole contract.</p>
  }

  return (
    <p className="text-muted-foreground text-sm">
      {left > 0
        ? `The stages come to ${percentAgreed}%. ${left}% of the contract is not set out in any of them.`
        : `The stages come to ${percentAgreed}%, which is ${Math.abs(left)}% more than the contract.`}
    </p>
  )
}

// A stage is billed on a day, and the day is the client's to be told: billing it as of today when the bill went out last week is how a ledger stops matching the paperwork.
function BillIt({ stage, onBill }: { stage: StageRow; onBill: (id: string, day: string) => Promise<void> }) {
  const [day, setDay] = useState(todayOnThisDevice)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function bill() {
    setSaving(true)
    setRefusal(null)

    try {
      await onBill(stage._id, day)
    } catch (thrown) {
      // A stage already billed is refused, and a refusal nobody shows is a button that does nothing twice.
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center justify-end gap-2">
        {/* Named on the box, because the question it answers is the row it is on. */}
        <Line
          look="beside"
          value={day}
          onChange={(event) => {
            setDay(event.target.value)
          }}
          type="date"
          aria-label={`When ${stage.description} was billed`}
          className="border-border text-muted-foreground w-auto rounded-md border px-2 py-1"
        />
        <Button look="beside" busy={saving} className="px-3 py-1 text-sm" onClick={bill}>
          Bill it
        </Button>
      </span>
      {refusal === null ? null : (
        <span role="alert" className="text-destructive text-sm">
          {refusal}
        </span>
      )}
    </span>
  )
}

function AddAStage({ onAdd }: { onAdd: (stage: { description: string; percent: string }) => Promise<void> }) {
  const [description, setDescription] = useState('')
  const [percent, setPercent] = useState('')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [added, setAdded] = useState(0)

  async function add() {
    setSaving(true)
    setRefusal(null)

    try {
      await onAdd({ description, percent })
      setDescription('')
      setPercent('')
      setAdded((before) => before + 1)
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form className="gap-4" freshAfter={added}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field
          label="What the stage is"
          hint="The way it reads on the contract."
          problem={whatIsWrong(milestoneInput.shape.description, description)}
        >
          <Line
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
            }}
            autoComplete="off"
            aria-label="What the stage is"
          />
        </Field>

        <Field label="Share of it" problem={whatIsWrong(percentRule, percent)}>
          <Line
            value={percent}
            onChange={(event) => {
              setPercent(event.target.value)
            }}
            inputMode="decimal"
            autoComplete="off"
            placeholder="20"
            aria-label="Share of it"
          />
        </Field>
      </div>

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div>
        <Button onClick={add} busy={saving} className="py-2 text-sm">
          Put the stage in
        </Button>
      </div>
    </Form>
  )
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{children}</h2>
}
