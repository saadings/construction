import { useState } from 'react'
import { whatIsWrong } from '~shared/validation/primitives'
import { areaWhileTyping, coveredArea, siteName } from '~shared/validation/site'

import { Button } from '../form/Button'
import { Choices, Field, Line, Picker } from '../form/Field'
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

export type HouseAsTyped = {
  name: string
  coveredAreaSqft: string
  stage: Stage
  builtForAClient: boolean
}

export type HouseAsSent = {
  name: string
  coveredAreaSqft?: string
  stage: Stage
  builtForAClient: boolean
}

export const anUnstartedHouse: HouseAsTyped = {
  name: '',
  coveredAreaSqft: '',
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
        stage,
        builtForAClient,
      })
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')
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

      <Field label="Where it has got to">
        <Picker
          value={stage}
          // Looked up in the list it was drawn from rather than asserted, so nothing unknown can become a stage.
          onChange={(event) => {
            setStage(STAGES.find((each) => each.value === event.target.value)?.value ?? stage)
          }}
          aria-label="Where it has got to"
        >
          {STAGES.map((each) => (
            <option key={each.value} value={each.value}>
              {each.label}
            </option>
          ))}
        </Picker>
      </Field>

      {/* Not a `Field`: a label points at one control, and the first choice inside one takes the label's words as its own name. "Ours to sell" announced itself as "Whose house". */}
      <Choices label="Whose house">
        <div className="grid grid-cols-2 gap-2">
          {[
            { forAClient: false, label: 'Ours to sell' },
            { forAClient: true, label: 'For a client' },
          ].map((choice) => (
            <button
              key={choice.label}
              type="button"
              role="radio"
              aria-checked={builtForAClient === choice.forAClient}
              onClick={() => {
                setForAClient(choice.forAClient)
              }}
              className={
                builtForAClient === choice.forAClient
                  ? 'border-primary bg-accent text-accent-foreground rounded-md border py-2.5 text-sm font-medium'
                  : 'border-border text-muted-foreground rounded-md border py-2.5 text-sm'
              }
            >
              {choice.label}
            </button>
          ))}
        </div>
      </Choices>

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
