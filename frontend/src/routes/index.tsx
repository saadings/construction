import { Show, SignInButton, UserButton } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { SitesList } from '../components/sites/SitesList'

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

  if (sites === undefined || sites === null) {
    return (
      <main className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center p-6">
        <p>Getting your sites…</p>
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
