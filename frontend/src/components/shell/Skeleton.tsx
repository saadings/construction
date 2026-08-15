import { cn } from '../../lib/utils'

// Nauman: "Use a skeleton and spinners for all of the loadings, for such UI use skeletons".

// A skeleton is a promise about what is coming, so it is drawn in the shape of the thing it stands in for. "Looking…" tells somebody to wait; a row of grey bars tells them what they are waiting for, and the screen does not jump when it arrives.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      // Nothing to read, so nothing is read out. The screen that owns it says what is coming.
      aria-hidden
      className={cn('bg-hairline animate-pulse rounded', className)}
    />
  )
}

// Held open while a screen is waiting. A person on a slow connection is told it is coming without being told to watch a word.
export function WhileWaiting({ what, children }: { what: string; children: React.ReactNode }) {
  return (
    // Announced once when it appears rather than on every frame, so a reader is not read a pulse.
    <div role="status" aria-live="polite" aria-label={what} className="flex flex-col gap-3">
      {children}
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
