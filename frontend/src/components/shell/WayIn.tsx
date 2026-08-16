import type { ComponentType, ReactNode } from 'react'

import { Button } from '../form/Button'

// The one screen there is signed out. It lives here rather than on the home route because the root renders it in place of whatever was asked for: every other screen is a form nobody signed in can send, over a reading that will never come back.

// What opens the sign-in is handed in, for the reason the nav's footer is: Clerk will not render outside its own provider and the gallery holds nothing that could reach a deployment, so this whole file was exempt -- and the exemption covered the screen rather than the wrapper. **The first screen he will ever see was drawn by nothing, photographed at no width and measured by nothing at all**, and if it is wrong he cannot get past it to reach the parts that are right.

// A wrapper rather than the whole control, which is the difference from the nav. Clerk's `SignInButton` puts an `onClick` on the child and draws no box of its own, so standing it in changes nothing anybody can see -- and the button in the picture is then the button that ships rather than a copy of it kept in step by hand.
export function WayIn({ opens: Opens }: { opens: ComponentType<{ children: ReactNode }> }) {
  return (
    <main className="bg-background mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-foreground font-display text-[2.75rem] leading-none">Construction</h1>
      <p className="text-muted-foreground">Sites, spending and what everyone is owed.</p>

      <Opens>
        <Button className="mt-2">Sign in</Button>
      </Opens>
    </main>
  )
}
