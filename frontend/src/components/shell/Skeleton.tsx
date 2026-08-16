import { useLongerThan } from '../../lib/longerThan'
import { cn } from '../../lib/utils'
import { Skeleton as OnShadcn } from '../ui/skeleton'

// Nauman: "Use a skeleton and spinners for all of the loadings, for such UI use skeletons".

// A skeleton is a promise about what is coming, so it is drawn in the shape of the thing it stands in for. "Looking…" tells somebody to wait; a row of grey bars tells them what they are waiting for, and the screen does not jump when it arrives.

// Built on shadcn's rather than on a `<div>`. `ui/skeleton.tsx` has been in the tree since the CLI copied it in, imported by their sidebar and by nothing else, while this drew the same thing by hand a few classes away -- which is the last of the four gaps the inventory found.

// Two of their defaults are undone, and the difference between the two is the point. `bg-accent` is taken back because the colour is a **decision**: `bg-hairline` is the token this app chose for a line that is barely there, and a skeleton is that colour on purpose. `rounded-md` is taken back because it is **not** a decision anybody made -- ours says `rounded` and theirs says `rounded-md`, and 2px of corner on every grey bar in the app is not a change this refactor is entitled to make. Rebuilding what a thing is made of is not permission to alter what it looks like.
export function Skeleton({ className }: { className?: string }) {
  return (
    <OnShadcn
      // Nothing to read, so nothing is read out. `WhileWaiting` below is what announces, and a reader hearing every bar would be read a pulse.
      aria-hidden
      className={cn('bg-hairline rounded', className)}
    />
  )
}

// The other end of the same silence a send has. Convex holds a subscription open until it can answer, so a reading on a phone with no signal does not fail -- it stays `undefined`, and these bars pulse for as long as somebody stands there.

// Twelve seconds rather than the eight a send gets: a reading arrives on its own and a send was asked for. Somebody watching a screen fill in will wait longer than somebody who has just pressed a button, and a sentence that arrives too early on a slow connection is a sentence he learns to read past.
const LONG_ENOUGH_TO_SAY_SOMETHING = 12_000

/** Held open while a screen is waiting. A person on a slow connection is told it is coming without being told to watch a word -- and told, once it has been too long, why they are still looking at grey bars. */
export function WhileWaiting({
  what,
  after = LONG_ENOUGH_TO_SAY_SOMETHING,
  children,
}: {
  what: string
  after?: number
  children: React.ReactNode
}) {
  const tooLong = useLongerThan(true, after)

  return (
    // Announced once when it appears rather than on every frame, so a reader is not read a pulse.
    <div role="status" aria-live="polite" aria-label={what} className="flex flex-col gap-3">
      {children}

      {/* Nothing has gone wrong and nothing has been lost, because nothing was typed. What it can promise is what Convex does: the subscription is still open and fills in the moment the connection is back. */}
      {tooLong ? (
        <p className="text-muted-foreground text-sm">
          This has not come through yet — the phone may have no signal. It will fill in as soon as it has.
        </p>
      ) : null}
    </div>
  )
}

// A line of text that has not arrived. Widths differ on purpose: five identical bars read as a table, not as a sentence coming.
export function SkeletonLines({ widths }: { widths: Array<string> }) {
  return (
    <>
      {widths.map((width, at) => (
        <Skeleton key={at} className={`h-4 ${width}`} />
      ))}
    </>
  )
}
