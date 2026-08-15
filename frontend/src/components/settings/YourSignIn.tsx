import { UserButton } from '@clerk/tanstack-react-start'

import { Page } from '../shell/Page'

// The way out, and its own screen now rather than a section shown only on a phone. The shell carries the same button where there is chrome to carry it -- the foot of the sidebar, the end of the top bar -- and a phone has neither, so this is how a phone reaches it.
export function YourSignIn() {
  return (
    <Page title="Your sign-in">
      <p className="text-muted-foreground max-w-prose text-sm">
        Tap it to sign out or to change your details. On a wider screen it also sits with the app’s own buttons, so you
        do not have to come here for it.
      </p>

      <div className="flex items-center gap-3">
        <UserButton />
      </div>
    </Page>
  )
}
