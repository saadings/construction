import { SignInButton } from '@clerk/tanstack-react-start'

import { Button } from '../form/Button'

// The one screen there is signed out. It lives here rather than on the home route because the root renders it in place of whatever was asked for: every other screen is a form nobody signed in can send, over a reading that will never come back.
export function WayIn() {
  return (
    <main className="bg-background mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-foreground font-display text-[2.75rem] leading-none">Construction</h1>
      <p className="text-muted-foreground">Sites, spending and what everyone is owed.</p>

      <SignInButton mode="modal">
        <Button className="mt-2">Sign in</Button>
      </SignInButton>
    </main>
  )
}
