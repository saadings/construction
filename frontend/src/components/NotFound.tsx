/**
 * What someone lands on when the address they followed matches no screen.
 *
 * Deliberately a plain link rather than a routed one: this is the screen shown
 * because the router did not recognise where it was asked to go, and a whole
 * fresh load back to the start is the one way back that cannot depend on it.
 *
 * The copy carries no status code and no term from the machinery. Someone
 * reaching this is already stuck, and "404" tells them nothing they can act
 * on — where to go next does.
 */
export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Nothing here</h1>
      <p className="text-muted-foreground text-lg">
        The link you followed doesn’t open anything. It may have changed since it was saved.
      </p>
      <a href="/" className="text-primary font-medium underline underline-offset-4">
        Go back to the start
      </a>
    </main>
  )
}
