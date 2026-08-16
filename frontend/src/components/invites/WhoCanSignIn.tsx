import { useState } from 'react'
import { SAY_CLERK } from '~shared/validation/invite'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'
import { StillSending } from '../form/StillSending'
import { WayOut } from '../form/WayOut'
import { whatWentWrong } from '../form/whatWentWrong'
import { Page } from '../shell/Page'
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
      // Its own words, because an invitation goes out through Clerk rather than into the ledger: it is a message that did not send, not a row that did not go in.

      // Read from where the server reads them, since this is the case where nothing arrived as words at all and the two would otherwise be one sentence spelled twice.
      setProblem(whatWentWrong(thrown, SAY_CLERK.unknown))
    } finally {
      setSending(false)
    }
  }

  return (
    // In a `Page` like every other screen a route draws. Without it this sat flush against the left edge of a phone -- the padding is written once there so six screens cannot each invent their own, and a screen that never renders one invents nothing and gets none.
    <Page title="Who can sign in">
      <div className="flex flex-col gap-1">
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

      <StillSending busy={sending} />

      {problem === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {problem}
        </p>
      )}

      <Waiting waiting={waiting} onTakeOff={onTakeOff} />
    </Page>
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

  // Only what an empty list can support. It used to add "Everyone invited has signed in", which is a claim about invitations that were sent -- and it said it just as readily on an instance where nobody has ever been invited, which is where Nauman read it while working out why inviting did not work. This component holds `waiting` and nothing else, so no wording it could carry would know the difference; the fact is not on this screen and does not belong on it.
  if (waiting.length === 0) {
    return <p className="text-muted-foreground text-sm">Nobody is waiting.</p>
  }

  return (
    <ul className="border-border divide-hairline divide-y rounded-md border">
      {waiting.map((invited) => (
        <li key={invited.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-foreground text-sm break-all">{invited.email}</span>
          <WayOut
            onClick={() => {
              void onTakeOff(invited.id)
            }}
            className="shrink-0"
          >
            Remove
          </WayOut>
        </li>
      ))}
    </ul>
  )
}

// What the server refused with, if it said anything a person can read. Anything else is the app failing rather than the person being wrong, and says so.
