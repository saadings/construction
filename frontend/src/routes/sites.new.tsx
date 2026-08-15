import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { whatIsWrong } from '~shared/validation/primitives'
import { areaWhileTyping, coveredArea, siteName } from '~shared/validation/site'

import { api } from '../../../convex/_generated/api'
import { Field, Line, Picker } from '../components/form/Field'
import { Form, Page } from '../components/shell/Page'

export const Route = createFileRoute('/sites/new')({ component: StartASite })

const STAGES = [
  { value: 'planning', label: 'Planning' },
  { value: 'building', label: 'Building' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'complete', label: 'Finished' },
  { value: 'sold', label: 'Sold' },
] as const

function StartASite() {
  const router = useRouter()
  const start = useMutation(api.sites.mutations.start)

  const [name, setName] = useState('')
  const [coveredAreaSqft, setArea] = useState('')
  const [stage, setStage] = useState<(typeof STAGES)[number]['value']>('building')
  const [builtForAClient, setForAClient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function put() {
    setSaving(true)
    setRefusal(null)

    try {
      await start({
        name,
        coveredAreaSqft: coveredAreaSqft.trim() === '' ? undefined : coveredAreaSqft,
        stage,
        builtForAClient,
      })
      await router.navigate({ to: '/' })
    } catch (thrown) {
      setRefusal(thrown instanceof ConvexError ? String(thrown.data) : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title="Start a house">
      <Form>
        {/* What is wrong is worked out on every keystroke and shown by `Field` only once the eye has left the answer. */}
        <Field label="Name" hint="The way you say it: 1-A, Phase 0." problem={whatIsWrong(siteName, name)}>
          <Line value={name} onChange={(event) => setName(event.target.value)} aria-label="Name" autoComplete="off" />
        </Field>

        <Field
          label="Covered area"
          hint="In square feet. Leave it empty if it is not settled yet."
          // Nothing typed is a perfectly good answer here, so an empty one has nothing wrong with it.
          problem={coveredAreaSqft.trim() === '' ? null : whatIsWrong(coveredArea, coveredAreaSqft)}
        >
          <Line
            value={coveredAreaSqft}
            // The keyboard hint below is a hint on a phone and nothing at all on a desktop, so what may be typed is decided here.
            onChange={(event) => setArea(areaWhileTyping(event.target.value))}
            inputMode="numeric"
            aria-label="Covered area"
            autoComplete="off"
          />
        </Field>

        <Field label="Where it has got to">
          <Picker
            value={stage}
            // Looked up in the list it was drawn from rather than asserted, so nothing unknown can become a stage.
            onChange={(event) => setStage(STAGES.find((each) => each.value === event.target.value)?.value ?? stage)}
            aria-label="Where it has got to"
          >
            {STAGES.map((each) => (
              <option key={each.value} value={each.value}>
                {each.label}
              </option>
            ))}
          </Picker>
        </Field>

        <Field label="Whose house">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Whose house">
            {[
              { forAClient: false, label: 'Ours to sell' },
              { forAClient: true, label: 'For a client' },
            ].map((choice) => (
              <button
                key={choice.label}
                type="button"
                role="radio"
                aria-checked={builtForAClient === choice.forAClient}
                onClick={() => setForAClient(choice.forAClient)}
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
        </Field>

        {refusal ? (
          <p className="text-destructive text-sm" role="alert">
            {refusal}
          </p>
        ) : null}

        <button
          type="button"
          onClick={put}
          disabled={saving}
          className="bg-primary text-primary-foreground rounded-md py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Starting…' : 'Start it'}
        </button>
      </Form>
    </Page>
  )
}
