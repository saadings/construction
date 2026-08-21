import { Link } from '@tanstack/react-router'

// A screen that has nothing to draw, and a way onward from it.

// Written once because it is the third of these. The day sheet, the house screen and now the daybook each had their own version of the same three lines, and they had already drifted: one was a `Page` with a title, one was a centred block, and only one of them said what to do next.

// The default wording is the one that has to survive: whether a house is gone or was never yours is exactly what the server refuses to leak, so saying `not yours` alone would undo that by admitting the house is there.
export function NothingToOpen({
  said = 'Nothing to open here.',
  because = 'This house may have been put away, or you may not be on it. Ask Nauman.',
  wayOut = 'Back to sites',
}: {
  said?: string
  because?: string
  wayOut?: string
}) {
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-foreground font-display text-2xl">{said}</p>
      <p className="text-muted-foreground max-w-xs">{because}</p>
      <Link to="/" className="text-primary pt-2 font-medium">
        {wayOut}
      </Link>
    </main>
  )
}
