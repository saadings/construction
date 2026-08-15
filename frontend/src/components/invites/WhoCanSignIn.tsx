import { useState } from 'react'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type Invited = { id: string; email: string; askedOn: number }

// Everyone asked in and not yet signed up. Somebody who has signed up is not here at all -- they are using the app, which is a different question and not one this screen answers.
export function WhoCanSignIn({
  waiting,
  onInvite,
  onTakeOff,
}: {
  waiting: Array<Invited> | null
  onInvite: (email: string) => Promise<void>
  onTakeOff: (id: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    setProblem(null)

    try {
      await onInvite(email)
      setEmail('')
    } catch (thrown) {
      setProblem(whatWentWrong(thrown))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-base font-medium">Who can sign in</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          They will get an email and can sign themselves in. Nothing else needs doing afterwards.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Email" className="flex-1">
          <Line
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
            type="email"
            inputMode="email"
            autoComplete="off"
            aria-label="Email"
            placeholder="them@example.com"
          />
        </Field>

        <Button onClick={send} busy={sending}>
          Invite someone
        </Button>
      </div>

      {problem === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {problem}
        </p>
      )}

      <Waiting waiting={waiting} onTakeOff={onTakeOff} />
    </section>
  )
}

function Waiting({ waiting, onTakeOff }: { waiting: Array<Invited> | null; onTakeOff: (id: string) => Promise<void> }) {
  if (waiting === null) {
    return (
      <WhileWaiting what="Getting who is waiting">
        <div className="border-border divide-hairline flex flex-col divide-y rounded-md border">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3 px-4 py-3">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-4 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </WhileWaiting>
    )
  }

  // Said out loud rather than left blank, because an empty space reads as something that has not loaded.
  if (waiting.length === 0) {
    return <p className="text-muted-foreground text-sm">Nobody is waiting. Everyone invited has signed in.</p>
  }

  return (
    <ul className="border-border divide-hairline divide-y rounded-md border">
      {waiting.map((invited) => (
        <li key={invited.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-foreground text-sm break-all">{invited.email}</span>
          <button
            type="button"
            onClick={() => {
              void onTakeOff(invited.id)
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline underline-offset-4"
          >
            Take them off
          </button>
        </li>
      ))}
    </ul>
  )
}

// What the server refused with, if it said anything a person can read. Anything else is the app failing rather than the person being wrong, and says so.
function whatWentWrong(thrown: unknown): string {
  const data: unknown = (thrown as { data?: unknown }).data

  return typeof data === 'string' && data !== '' ? data : 'That did not go through. Try once more in a moment.'
}
