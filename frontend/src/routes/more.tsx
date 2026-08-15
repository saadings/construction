import { createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import type { Invited } from '../components/invites/WhoCanSignIn'
import { WhoCanSignIn } from '../components/invites/WhoCanSignIn'
import { Form, Page } from '../components/shell/Page'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import type { HowItLooks } from '../lib/theme'
import { useHowItLooks } from '../lib/theme'

export const Route = createFileRoute('/more')({ component: More })

const LOOKS: Array<{ value: HowItLooks; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'follow', label: 'Follow the phone' },
]

function More() {
  const { chosen, choose } = useHowItLooks()

  return (
    <Page title="More">
      <Form>
        <Invites />

        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-base font-medium">How it looks</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Following the phone is usually right. Change it when you are outside and the screen is hard to read.
          </p>

          <ToggleGroup
            type="single"
            value={chosen}
            // A segmented control hands back an empty string when the pressed one is pressed again, and that is not a fourth way for the app to look.
            onValueChange={(picked) => {
              const known = LOOKS.find((look) => look.value === picked)
              if (known !== undefined) {
                choose(known.value)
              }
            }}
            variant="outline"
            aria-label="How it looks"
            className="w-full max-w-md"
          >
            {LOOKS.map((look) => (
              <ToggleGroupItem key={look.value} value={look.value} className="flex-1">
                {look.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      </Form>
    </Page>
  )
}

// The list comes from Clerk rather than from a table of ours, so it is asked for rather than watched: there is nothing here to keep in step with theirs.
function Invites() {
  const whoIsWaiting = useAction(api.invites.actions.whoIsWaiting)
  const invite = useAction(api.invites.actions.invite)
  const takeOff = useAction(api.invites.actions.takeOff)

  const [waiting, setWaiting] = useState<Array<Invited> | null>(null)

  const refresh = useCallback(async () => {
    setWaiting(await whoIsWaiting({}))
  }, [whoIsWaiting])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <WhoCanSignIn
      waiting={waiting}
      onInvite={async (email) => {
        await invite({ email })
        await refresh()
      }}
      onTakeOff={async (id) => {
        await takeOff({ id })
        await refresh()
      }}
    />
  )
}
