import { useState } from 'react'
import { todayOnThisDevice } from '~shared/calendarDate'
import { groupWhileTyping } from '~shared/money'
import { SAY_CONTRACT, areaSqft } from '~shared/validation/contract'
import { calendarDay, note as noteRule, positiveMoney, whatIsWrong } from '~shared/validation/primitives'

import { Button } from '../form/Button'
import { Choices } from '../form/Choices'
import { Day } from '../form/Day'
import { Field, Line, Lines } from '../form/Field'
import { NOBODY, PickAPerson, asAsked } from '../form/PickAPerson'
import { StillSending } from '../form/StillSending'
import { whatWentWrong } from '../form/whatWentWrong'
import { Form } from '../shell/Page'

// What a client agreed to pay for a house. Nothing else about billing works without it: a stage is a percentage of this, and until it is here the whole billing half of the screen has figures with nothing behind them.

// Priced one way or the other, never both. A lump sum carries no rate and a rate carries no total, so neither is left behind when the other changes.
export type Priced = { how: 'lumpSum'; totalPaisa: string } | { how: 'ratePerSqft'; ratePerSqftPaisa: string }

export type AgreedContract = {
  // Who it is for, said the way every other screen says it now: an id when he was picked, a name when he was typed.
  personId?: string
  newPerson?: string
  agreedOn: string
  priced: Priced
  agreedAreaSqft: string
  note?: string
}

export type ClientRow = { _id: string; name: string }

const HOW = [
  { is: 'lumpSum' as const, said: 'One agreed price' },
  { is: 'ratePerSqft' as const, said: 'A rate per square foot' },
]

export function AgreeAContract({
  people,
  onAgree,
}: {
  people: Array<ClientRow>
  onAgree: (contract: AgreedContract) => Promise<void>
}) {
  const [client, setClient] = useState(NOBODY)
  const [agreedOn, setAgreedOn] = useState(todayOnThisDevice)
  const [how, setHow] = useState<Priced['how']>('lumpSum')
  const [amount, setAmount] = useState('')
  const [area, setArea] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(0)

  async function agree() {
    setSaving(true)
    setRefusal(null)

    try {
      await onAgree({
        ...asAsked(client),
        agreedOn,
        priced: how === 'lumpSum' ? { how, totalPaisa: amount } : { how, ratePerSqftPaisa: amount },
        agreedAreaSqft: area,
        note: note.trim() === '' ? undefined : note,
      })
      setAmount('')
      setArea('')
      setNote('')
      setAgreed((before) => before + 1)
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form className="gap-5" freshAfter={agreed}>
      <div className="grid gap-5 sm:grid-cols-2">
        <PickAPerson
          label="Who it is for"
          problem={client.personId === '' && client.newPerson === '' ? SAY_CONTRACT.client : null}
          who={client}
          people={people}
          onChange={setClient}
        />

        <Day label="Agreed on" problem={whatIsWrong(calendarDay, agreedOn)} value={agreedOn} onPick={setAgreedOn} />
      </div>

      {/* Not a `Field`: the first choice inside a label takes the label's words as its own name, so "One agreed price" announced itself as "How it is priced". */}
      <Choices label="How it is priced" chosen={how} choices={HOW} onChoose={setHow} />

      <div className="grid gap-5 sm:grid-cols-2">
        {/* One box, asked two ways. A rate and a total in the same form is how one of them gets left behind holding an old figure. */}
        <Field
          label={how === 'lumpSum' ? 'The whole price' : 'Rate per square foot'}
          problem={whatIsWrong(positiveMoney, amount)}
        >
          <Line
            value={amount}
            onChange={(event) => {
              setAmount(groupWhileTyping(event.target.value))
            }}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-label={how === 'lumpSum' ? 'The whole price' : 'Rate per square foot'}
          />
        </Field>

        <Field
          label="Area agreed"
          hint="Square feet. What was measured comes later."
          problem={whatIsWrong(areaSqft, area)}
        >
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
      </div>

      <Field label="Anything worth remembering" problem={note === '' ? null : whatIsWrong(noteRule, note)}>
        <Lines
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          aria-label="Anything worth remembering"
        />
      </Field>

      <StillSending busy={saving} />
      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div>
        <Button onClick={agree} busy={saving}>
          Agree it
        </Button>
      </div>
    </Form>
  )
}
