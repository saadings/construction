import { useState } from 'react'
import { groupWhileTyping } from '~shared/money'
import { whatIsWrong } from '~shared/validation/primitives'
import { areaWhileTyping, budgetEstimate, coveredArea, siteName } from '~shared/validation/site'

import { Button } from '../form/Button'
import { Choices } from '../form/Choices'
import { Field, Line } from '../form/Field'
import { Pick } from '../form/Pick'
import { StillSending } from '../form/StillSending'
import { whatWentWrong } from '../form/whatWentWrong'
import { Form } from '../shell/Page'

// What a house is, asked once. Starting one and correcting one ask exactly the same questions, and two forms would drift until correcting a house lost the answer starting it had taken.

export const STAGES = [
  { value: 'planning', label: 'Planning' },
  { value: 'building', label: 'Building' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'complete', label: 'Finished' },
  { value: 'sold', label: 'Sold' },
] as const

export type Stage = (typeof STAGES)[number]['value']

// The same five, said the way a control that deals in rows wants them.
const AS_CHOICES = STAGES.map((each) => ({ _id: each.value, name: each.label }))

export type HouseAsTyped = {
  name: string
  coveredAreaSqft: string
  budgetEstimatePaisa: string
  stage: Stage
  builtForAClient: boolean
}

export type HouseAsSent = {
  name: string
  coveredAreaSqft?: string
  budgetEstimatePaisa?: string
  stage: Stage
  builtForAClient: boolean
}

export const anUnstartedHouse: HouseAsTyped = {
  name: '',
  coveredAreaSqft: '',
  budgetEstimatePaisa: '',
  stage: 'building',
  builtForAClient: false,
}

export function HouseDetails({
  house = anUnstartedHouse,
  saying,
  onSave,
  beneath,
}: {
  house?: HouseAsTyped
  saying: string
  onSave: (house: HouseAsSent) => Promise<void>
  beneath?: React.ReactNode
}) {
  const [name, setName] = useState(house.name)
  const [coveredAreaSqft, setArea] = useState(house.coveredAreaSqft)
  const [budgetEstimatePaisa, setEstimate] = useState(house.budgetEstimatePaisa)
  const [stage, setStage] = useState<Stage>(house.stage)
  const [builtForAClient, setForAClient] = useState(house.builtForAClient)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setRefusal(null)

    try {
      await onSave({
        name,
        // Nothing typed is a perfectly good answer, and an empty string is not a covered area.
        coveredAreaSqft: coveredAreaSqft.trim() === '' ? undefined : coveredAreaSqft,
        // A house nobody has estimated is not a house estimated at nothing, which is why this is absent rather than zero.
        budgetEstimatePaisa: budgetEstimatePaisa.trim() === '' ? undefined : budgetEstimatePaisa,
        stage,
        builtForAClient,
      })
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form>
      {/* What is wrong is worked out on every keystroke and shown by `Field` only once the eye has left the answer. */}
      <Field label="Name" hint="The way you say it: 1-A, Phase 0." problem={whatIsWrong(siteName, name)}>
        <Line
          value={name}
          onChange={(event) => {
            setName(event.target.value)
          }}
          aria-label="Name"
          autoComplete="off"
        />
      </Field>

      {/* Side by side as drawn: how big it is and what it is expected to cost are the pair somebody answers together. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field
          label="Covered area"
          hint="In square feet. Leave it empty if it is not settled yet."
          problem={coveredAreaSqft.trim() === '' ? null : whatIsWrong(coveredArea, coveredAreaSqft)}
        >
          <Line
            value={coveredAreaSqft}
            // The keyboard hint below is a hint on a phone and nothing at all on a desktop, so what may be typed is decided here.
            onChange={(event) => {
              setArea(areaWhileTyping(event.target.value))
            }}
            inputMode="numeric"
            aria-label="Covered area"
            autoComplete="off"
          />
        </Field>

        {/* The field the whole estimate read path was waiting for. It was stored, accepted by the mutation, returned by the query and drawn on two screens -- and no form asked for it, so every house read `No estimate set` and the bar beside it never drew at all. */}
        <Field
          label="Budget estimate"
          hint="What you expect the build to cost. Spending is measured against this."
          problem={budgetEstimatePaisa.trim() === '' ? null : whatIsWrong(budgetEstimate, budgetEstimatePaisa)}
        >
          {/* `Rs` and not the drawn `PKR`: every other figure this app asks for is asked in `Rs`, and one money under two names is two moneys to whoever is reading. */}

          {/* Inside the box as drawn, rather than beside it. Beside it, the word took its width out of the input -- so this box and `Covered area` next to it were different widths, which reads as a broken form rather than a deliberate pair. */}
          <span className="relative flex items-center">
            <span className="text-faint pointer-events-none absolute left-3 text-sm">Rs</span>
            <Line
              value={budgetEstimatePaisa}
              onChange={(event) => {
                setEstimate(groupWhileTyping(event.target.value))
              }}
              inputMode="numeric"
              aria-label="Budget estimate"
              autoComplete="off"
              className="w-full pl-10"
            />
          </span>
        </Field>
      </div>

      <Pick
        label="Stage"
        chosen={AS_CHOICES.find((each) => each._id === stage) ?? null}
        choices={AS_CHOICES}
        // Looked up in the list it was drawn from rather than asserted, so nothing unknown can become a stage.
        onPick={(picked) => {
          setStage(STAGES.find((each) => each.value === picked?._id)?.value ?? stage)
        }}
      />

      {/* Not a `Field`: a label points at one control, and the first choice inside one takes the label's words as its own name. "Ours to sell" announced itself as "Built for". */}
      <Choices
        label="Built for"
        chosen={builtForAClient}
        choices={[
          { is: false, said: 'Ours to sell' },
          { is: true, said: 'For a client' },
        ]}
        onChoose={setForAClient}
      />

      <StillSending busy={saving} />
      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <Button onClick={save} busy={saving}>
        {saying}
      </Button>

      {beneath}
    </Form>
  )
}
