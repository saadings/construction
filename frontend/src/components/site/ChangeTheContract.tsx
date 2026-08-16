import { useEffect, useRef, useState } from 'react'
import { groupWhileTyping } from '~shared/money'
import { areaSqft } from '~shared/validation/contract'
import { note as noteRule, positiveMoney, whatIsWrong } from '~shared/validation/primitives'

import { Button } from '../form/Button'
import { Choices } from '../form/Choices'
import { Field, Line, Lines } from '../form/Field'
import { StillSending } from '../form/StillSending'
import { WayOut } from '../form/WayOut'
import { whatWentWrong } from '../form/whatWentWrong'
import { Form } from '../shell/Page'
import type { Priced } from './AgreeAContract'

// A house is agreed once and then measured, and a rate typed wrong is otherwise permanent: agreeing refuses a second contract while the first stands, and nothing else could reach the first.

export type StandingContract = {
  priced: { how: 'lumpSum'; totalPaisa: number } | { how: 'ratePerSqft'; ratePerSqftPaisa: number }
  agreedAreaSqft: number
  actualAreaSqft?: number
}

export type Revision = { priced: Priced; agreedAreaSqft: string; note?: string }

export function ChangeTheContract({
  contract,
  onMeasure,
  onRevise,
  onCancel,
}: {
  contract: StandingContract
  onMeasure: (actualAreaSqft: string) => Promise<void>
  onRevise: (revision: Revision) => Promise<void>
  onCancel: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button
        look="another"
        className="self-start"
        onClick={() => {
          setOpen(true)
        }}
      >
        Change it
      </Button>
    )
  }

  return (
    <div className="border-border flex flex-col gap-7 rounded-md border p-4">
      <Measure contract={contract} onMeasure={onMeasure} />
      <Revise contract={contract} onRevise={onRevise} />
      <Cancel onCancel={onCancel} />

      <WayOut
        className="self-start"
        onClick={() => {
          setOpen(false)
        }}
      >
        Cancel
      </WayOut>
    </div>
  )
}

// What was measured, once anybody has measured. The agreed figure is never touched by this, because that is what a disagreement is settled against.
function Measure({ contract, onMeasure }: { contract: StandingContract; onMeasure: (sqft: string) => Promise<void> }) {
  // Grouped from the moment it opens. A figure that is bare until somebody types in it reads as a different kind of number to every other figure on the screen.
  const [measured, setMeasured] = useState(
    contract.actualAreaSqft === undefined ? '' : groupWhileTyping(contract.actualAreaSqft.toString())
  )
  const { saving, refusal, send } = useWhileSending()

  return (
    <Form className="max-w-md gap-3">
      <Field
        label="Area measured"
        // Read off the first picture ever taken of this screen: "A rate contract follows this the day it is put in" parses two ways and says neither of them plainly. What it means is that `areaThatCounts` prefers a measured area over an agreed one from the moment there is one.
        hint={`Agreed at ${contract.agreedAreaSqft.toLocaleString()} sq ft. Once this is in, a rate contract is worked out from it instead.`}
        problem={measured === '' ? null : whatIsWrong(areaSqft, measured)}
      >
        <Line
          value={measured}
          onChange={(event) => {
            setMeasured(groupWhileTyping(event.target.value))
          }}
          inputMode="decimal"
          autoComplete="off"
          aria-label="Area measured"
        />
      </Field>

      <Said refusal={refusal} />
      <StillSending busy={saving} />
      <Button
        onClick={() => send(async () => await onMeasure(measured))}
        busy={saving}
        className="self-start py-2 text-sm"
      >
        Save measurement
      </Button>
    </Form>
  )
}

// A rate or a price typed wrong. Who agreed it and the day they did are left where they are: changing those is a different contract rather than a correction.
function Revise({ contract, onRevise }: { contract: StandingContract; onRevise: (r: Revision) => Promise<void> }) {
  const [how, setHow] = useState<Priced['how']>(contract.priced.how)
  const [amount, setAmount] = useState(
    groupWhileTyping(
      contract.priced.how === 'lumpSum'
        ? (contract.priced.totalPaisa / 100).toString()
        : (contract.priced.ratePerSqftPaisa / 100).toString()
    )
  )
  const [area, setArea] = useState(groupWhileTyping(contract.agreedAreaSqft.toString()))
  const [note, setNote] = useState('')
  const { saving, refusal, send } = useWhileSending()

  return (
    <Form className="max-w-md gap-3">
      {/* The question is now written above the row rather than only spoken to a screen reader: this was the one row in the app named by `aria-label` alone, so the two boxes sat over "The whole price" with nothing saying what they were choosing between. */}
      <Choices
        label="Pricing"
        chosen={how}
        choices={[
          { is: 'lumpSum', said: 'One agreed price' },
          { is: 'ratePerSqft', said: 'A rate per square foot' },
        ]}
        onChoose={setHow}
      />

      <Field
        label={how === 'lumpSum' ? 'Contract price' : 'Rate per square foot'}
        problem={whatIsWrong(positiveMoney, amount)}
      >
        <Line
          value={amount}
          onChange={(event) => {
            setAmount(groupWhileTyping(event.target.value))
          }}
          inputMode="decimal"
          autoComplete="off"
          aria-label={how === 'lumpSum' ? 'Contract price' : 'Rate per square foot'}
        />
      </Field>

      <Field label="Area agreed" problem={whatIsWrong(areaSqft, area)}>
        <Line
          value={area}
          onChange={(event) => {
            setArea(groupWhileTyping(event.target.value))
          }}
          inputMode="decimal"
          autoComplete="off"
          aria-label="Area agreed"
        />
      </Field>

      <Field label="Reason" problem={note === '' ? null : whatIsWrong(noteRule, note)}>
        <Lines
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          aria-label="Reason"
        />
      </Field>

      <Said refusal={refusal} />
      <StillSending busy={saving} />
      <Button
        onClick={() =>
          send(
            async () =>
              await onRevise({
                priced: how === 'lumpSum' ? { how, totalPaisa: amount } : { how, ratePerSqftPaisa: amount },
                agreedAreaSqft: area,
                note: note.trim() === '' ? undefined : note,
              })
          )
        }
        busy={saving}
        className="self-start py-2 text-sm"
      >
        Save changes
      </Button>
    </Form>
  )
}

// Cancelled, never erased. Asked twice, because it takes the whole billing side of a house off the screen.
function Cancel({ onCancel }: { onCancel: () => Promise<void> }) {
  const [sure, setSure] = useState(false)
  const asked = useRef<HTMLDivElement>(null)
  const { saving, refusal, send } = useWhileSending()

  // Brought onto the screen rather than left where it was drawn, the same as the question `PickATrade` opens under its field. This one asks whether to take the whole billing side of a house away, and it replaces a line of text with a row of two controls that is taller -- so at 390, on a page already near its bottom, tapping the destructive control put the confirmation five pixels under the fold and nothing appeared to happen.

  // `center` rather than `nearest`, which is what the question under a field uses. Nearest moves by the least it can, and the least it can here left the button's last half-pixel on the fold: a confirmation that is technically in frame is not one somebody has been shown. This is the last thing on the page, so centring it is the page scrolling to its end, which is where he is trying to get.
  useEffect(() => {
    if (sure) asked.current?.scrollIntoView({ block: 'center' })
  }, [sure])

  return (
    <div className="border-hairline flex flex-col gap-2 border-t pt-5">
      <p className="text-muted-foreground text-sm">
        A cancelled contract stays on the house, so what was agreed can still be read. The house can then be agreed
        again.
      </p>
      <Said refusal={refusal} />
      <StillSending busy={saving} />
      {sure ? (
        <div ref={asked} className="flex flex-wrap gap-3">
          <Button look="beside" onClick={() => send(onCancel)} busy={saving} className="py-2 text-sm">
            Yes, cancel it
          </Button>
          <WayOut
            onClick={() => {
              setSure(false)
            }}
          >
            Keep it
          </WayOut>
        </div>
      ) : (
        <WayOut
          className="self-start"
          onClick={() => {
            setSure(true)
          }}
        >
          Cancel this contract
        </WayOut>
      )}
    </div>
  )
}

// The three of these send in exactly the same shape, and writing it out three times is three chances for one of them to swallow what the server said.
function useWhileSending() {
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  return {
    saving,
    refusal,
    send: async (what: () => Promise<void>) => {
      setSaving(true)
      setRefusal(null)

      try {
        await what()
      } catch (thrown) {
        setRefusal(whatWentWrong(thrown))
      } finally {
        setSaving(false)
      }
    },
  }
}

function Said({ refusal }: { refusal: string | null }) {
  if (refusal === null) return null

  return (
    <p className="text-destructive text-sm" role="alert">
      {refusal}
    </p>
  )
}
