// A Convex read answers `undefined` while it is on its way and `null` when it refuses. This is what the refusal looks like: the ledger has come back and said it does not know this sign-in.

// Written once because it is said on every screen that reads anything, and a remedy that differs by screen is a remedy nobody trusts. It is never shown for a read still in flight -- that was the permanent spinner.
export function NotKnownHere() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-foreground font-display text-2xl">Setting your sign-in up.</p>
      <p className="text-muted-foreground max-w-xs">
        This takes a moment the first time. If it is still here after that, sign out and in again.
      </p>
    </div>
  )
}
