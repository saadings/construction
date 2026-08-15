import { UserButton } from '@clerk/tanstack-react-start'

// The way out, on a phone. A desk and a tablet have chrome to put it in -- the foot of the sidebar, the end of the top bar -- and a phone has only the bar along the bottom, which holds four places and has four.

// So it lives here, which is where the design puts it: "Account, how it looks, who can sign in, setting up a site, the trade list". Account was first on that list and had never been built, which is how signing out came to exist on one screen out of nine.
export function YourSignIn() {
  return (
    <section className="flex flex-col gap-3 sm:hidden">
      <h2 className="text-foreground text-base font-medium">Your sign-in</h2>
      <p className="text-muted-foreground max-w-prose text-sm">
        Tap it to sign out or to change your details. On a bigger screen it sits with the rest of the app’s own buttons
        instead.
      </p>

      <div className="flex items-center gap-3">
        <UserButton />
      </div>
    </section>
  )
}
