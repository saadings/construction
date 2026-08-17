import { useQuery } from 'convex/react'
import { useCallback, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { Finding, WayToFind, useTheShortcut, whatCanBeFound } from './Finding'

// What the shell draws. Everything that touches the ledger is here and nothing that draws is: `Finding` takes what it shows as a prop, so the gallery can photograph it with invented names and the sweep can measure it.

// That split is not tidiness. The nav spent an afternoon unphotographed and unmeasured because it lived inside the one component nothing here can render, and a search nobody has looked at is a search that looks fine.

// Nothing is read until somebody searches. `sites.all` works out what has been spent on each house from the payments behind it, which is a real read to run on every screen for a list nobody has opened -- so both queries are skipped while the dialog is closed, and the dialog says which of "nothing yet" and "nothing found" it means.
export function TheSearch() {
  const [open, setOpen] = useState(false)

  // Held in a callback because the shortcut listens on the window and re-binds whenever what it calls changes. Written out rather than left to `setOpen(true)` inline, which is a new function every render and a listener added and removed on every one of them.
  const show = useCallback(() => {
    setOpen(true)
  }, [])

  useTheShortcut(show)

  // Named as what search needs rather than passed whole: `sites.all` answers with everything a house screen wants, and only two fields of it mean anything to somebody typing a name.
  const houses = useQuery(api.sites.queries.all, open ? {} : 'skip')
  const people = useQuery(api.people.queries.list, open ? {} : 'skip')

  return (
    <>
      <WayToFind onOpen={show} />
      <Finding found={whatCanBeFound(houses, people)} open={open} onOpen={setOpen} />
    </>
  )
}
