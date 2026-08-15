import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { pakistaniMobile, personName, whatIsWrong } from '~shared/validation/primitives'

import { Button } from '../form/Button'
import { Field, Line, Lines } from '../form/Field'
import { NotKnownHere } from '../shell/NotKnownHere'
import { Form, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type PersonRow = { _id: string; name: string; phone?: string; notes?: string }
export type NewPerson = { name: string; phone?: string; notes?: string }

// Everyone the business deals with, with no role on them: the same man invests in one house and sells steel to another. What he is on a house is written where the money needs it.

// The same markup at every width. A phone gets the name and the number; a desk gets what was written down about them as well.
const ROW = 'grid grid-cols-[1fr_auto] items-baseline gap-x-4 sm:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)]'

export function People({
  people,
  onAdd,
  onEdit,
  onHide,
}: {
  // Three answers, never two: still coming, refused, and a list. Folding the first two together is the spinner nobody could get past.
  people: Array<PersonRow> | null | undefined
  onAdd: (person: NewPerson) => Promise<void>
  // A name typed wrong was permanent, and two people cannot share a name any more, so there was no way to work around it by adding the right one.
  onEdit: (personId: string, person: NewPerson) => Promise<void>
  onHide: (personId: string) => Promise<void>
}) {
  // The ledger has answered and does not know this sign-in. Nothing on this screen would work, so it offers none of it.
  if (people === null) {
    return (
      <Page title="People">
        <NotKnownHere />
      </Page>
    )
  }

  return (
    <Page title="People">
      <AddSomebody onAdd={onAdd} />

      {people === undefined ? (
        <WhileWaiting what="Getting the people">
          <div className="divide-hairline flex flex-col divide-y">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className={`${ROW} py-3.5`}>
                <Skeleton className="h-5 w-36 max-w-full" />
                <Skeleton className="order-last col-span-2 h-4 w-28 sm:order-none sm:col-span-1" />
                <Skeleton className="hidden h-4 w-44 max-w-full sm:block" />
              </div>
            ))}
          </div>
        </WhileWaiting>
      ) : people.length === 0 ? (
        <p className="text-muted-foreground py-6">
          Nobody yet. Add the partners and the contractors, and the money goes against their names.
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
          >
            <span>Name</span>
            <span>Number</span>
            <span>What was written down</span>
          </div>

          <ul aria-label="Everyone in the ledger" className="divide-hairline flex flex-col divide-y">
            {people.map((person) => (
              <OnePerson key={person._id} person={person} onEdit={onEdit} onHide={onHide} />
            ))}
          </ul>
        </div>
      )}
    </Page>
  )
}

function OnePerson({
  person,
  onEdit,
  onHide,
}: {
  person: PersonRow
  onEdit: (personId: string, person: NewPerson) => Promise<void>
  onHide: (personId: string) => Promise<void>
}) {
  const [changing, setChanging] = useState(false)
  const [name, setName] = useState(person.name)
  const [phone, setPhone] = useState(person.phone ?? '')
  const [notes, setNotes] = useState(person.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const wrongPhone = phone.trim() === '' ? null : whatIsWrong(pakistaniMobile, phone)

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
      <li className={`${ROW} py-3.5`}>
        {/* The way into their account, which is the statement the workbooks were kept open to read. Correcting them is the button on the right; this is the other half of what a name is for. */}
        <Link
          to="/people/$personId"
          params={{ personId: person._id }}
          className="text-foreground min-w-0 truncate text-[1.0625rem] underline-offset-4 hover:underline"
        >
          {person.name}
        </Link>
        <span className="text-muted-foreground order-last col-span-2 text-sm sm:order-none sm:col-span-1">
          {person.phone ?? '—'}
        </span>
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground hidden min-w-0 truncate text-sm sm:block">{person.notes ?? ''}</span>
          <button
            type="button"
            onClick={() => {
              setChanging(true)
            }}
            className="text-primary shrink-0 text-sm font-medium"
          >
            Change
          </button>
        </span>
        {refusal === null ? null : (
          <span role="alert" className="text-destructive col-span-full text-sm">
            {refusal}
          </span>
        )}
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" problem={whatIsWrong(personName, name)}>
          <Line
            value={name}
            onChange={(event) => {
              setName(event.target.value)
            }}
            autoComplete="off"
            aria-label={`What ${person.name} is called`}
          />
        </Field>

        <Field label="Number" hint="Leave it empty if you do not have one." problem={wrongPhone}>
          <Line
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
            }}
            inputMode="tel"
            autoComplete="off"
            placeholder="0300-0000000"
            aria-label={`The number for ${person.name}`}
          />
        </Field>
      </div>

      <Field label="Anything worth remembering">
        <Lines
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value)
          }}
          aria-label={`What was written down about ${person.name}`}
        />
      </Field>

      {refusal === null ? null : (
        <span role="alert" className="text-destructive text-sm">
          {refusal}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          busy={saving}
          className="py-2 text-sm"
          onClick={() =>
            send(async () => {
              await onEdit(person._id, {
                name,
                phone: phone.trim() === '' ? undefined : phone,
                notes: notes.trim() === '' ? undefined : notes,
              })
            })
          }
        >
          Save it
        </Button>
        <button
          type="button"
          onClick={() => {
            setName(person.name)
            setPhone(person.phone ?? '')
            setNotes(person.notes ?? '')
            setChanging(false)
          }}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          Never mind
        </button>
        {/* Hidden rather than deleted, because payments point at a person forever. */}
        <button
          type="button"
          onClick={() => send(async () => await onHide(person._id))}
          className="text-destructive ml-auto text-sm"
        >
          Take off the list
        </button>
      </div>
    </li>
  )
}

function AddSomebody({ onAdd }: { onAdd: (person: NewPerson) => Promise<void> }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  // Counted rather than a flag, because the second person added has to reset the form as thoroughly as the first.
  const [gonein, setGoneIn] = useState(0)

  // Nothing typed is a perfectly good answer for a number, so an empty one has nothing wrong with it.
  const wrongPhone = phone.trim() === '' ? null : whatIsWrong(pakistaniMobile, phone)

  async function add() {
    setSaving(true)
    setRefusal(null)

    try {
      await onAdd({
        name,
        phone: phone.trim() === '' ? undefined : phone,
        notes: notes.trim() === '' ? undefined : notes,
      })
      setName('')
      setPhone('')
      setNotes('')
      setGoneIn((before) => before + 1)
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form className="gap-5" freshAfter={gonein}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" hint="The way you say it." problem={whatIsWrong(personName, name)}>
          <Line
            value={name}
            onChange={(event) => {
              setName(event.target.value)
            }}
            aria-label="Name"
            autoComplete="off"
          />
        </Field>

        <Field label="Number" hint="Leave it empty if you do not have one." problem={wrongPhone}>
          <Line
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
            }}
            inputMode="tel"
            aria-label="Number"
            autoComplete="off"
            placeholder="0300-0000000"
          />
        </Field>
      </div>

      <Field label="Anything worth remembering">
        <Lines
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value)
          }}
          aria-label="Anything worth remembering"
        />
      </Field>

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div>
        <Button onClick={add} busy={saving}>
          Add them
        </Button>
      </div>
    </Form>
  )
}
