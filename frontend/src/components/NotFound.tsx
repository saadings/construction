// Shown when an address matches no screen; the way out is a plain link, because the router is what just failed.
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
