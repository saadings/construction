import { Show, SignInButton, UserButton } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { NotKnownHere } from '../components/shell/NotKnownHere'
import { SitesList, SitesListWaiting } from '../components/sites/SitesList'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <>
      <Show when="signed-out">
        <WayIn />
      </Show>
      <Show when="signed-in">
        <HisSites />
      </Show>
    </>
  )
}

function HisSites() {
  const sites = useQuery(api.sites.queries.all, {})

  // Waiting. Nothing has come back yet, so the screen holds the shape of the list rather than a word in the middle of an empty page.
  if (sites === undefined) {
    return <SitesListWaiting />
  }

  // An answer, and a definite one: the ledger does not know this sign-in. Shown as waiting it becomes a spinner nobody can get past, which is what it was.
  if (sites === null) {
    return (
      <main className="bg-background flex min-h-dvh flex-col justify-center p-6">
        <NotKnownHere />
      </main>
    )
  }

  return (
    <>
      <SitesList sites={sites} />
      <div className="fixed top-5 right-5">
        <UserButton />
      </div>
    </>
  )
}

function WayIn() {
  return (
    <main className="bg-background mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-foreground font-display text-[2.75rem] leading-none">Construction</h1>
      <p className="text-muted-foreground">Sites, spending and what everyone is owed.</p>

      <SignInButton mode="modal">
        <button className="bg-primary text-primary-foreground mt-2 rounded-md px-6 py-3 font-medium">Sign in</button>
      </SignInButton>
    </main>
  )
}
