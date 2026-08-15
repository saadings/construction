import { createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import type { Invited } from '../components/invites/WhoCanSignIn'
import { WhoCanSignIn } from '../components/invites/WhoCanSignIn'

export const Route = createFileRoute('/more/who-can-sign-in')({ component: WhoIsLetIn })

// The list comes from Clerk rather than from a table of ours, so it is asked for rather than watched: there is nothing here to keep in step with theirs.
function WhoIsLetIn() {
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
