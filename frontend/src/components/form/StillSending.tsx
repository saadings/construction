import { useLongerThan } from '../../lib/longerThan'

// What a phone with no signal does to this app, which is nothing anybody can see.

// Convex does not fail a mutation when the connection drops. It queues it and retries when the connection comes back -- which is the right behaviour and is why a payment typed on a site is not lost. What it means for the screen is that the promise never settles: `saving` stays true, the button stays off, the ring turns, and **nothing is said, for as long as he stands there**.

// He enters payments standing on a building site. A spinner with no end is what he meets the first time the signal goes, and it is indistinguishable from an app that has crashed.

// Time rather than the connection state, deliberately. `useConvexConnectionState` would say whether the socket is up, and it throws outside a provider -- so a screen using it could not be drawn in the gallery or in a test, which is where every screen here is looked at. The sentence is the same either way: it has not gone in yet, and it will.

// What it may promise was read out of the client rather than assumed, because a wrong reassurance about his money is worse than a spinner. `request_manager.restart()` re-sends every inflight **mutation** when the connection comes back and its promise stays pending until the server answers -- so "it will go in" is true. An **action** is failed with "Connection lost while action was in flight", which ends the send and shows a refusal, so this is never on screen claiming otherwise.

// And the queue is in memory. A payment waiting for signal is lost if the app is closed, which is the one thing he has to be told rather than reassured about -- so the sentence asks him to leave the screen open rather than saying nothing is lost.

/** How long a send may take before the screen owes him a sentence. Long enough that a slow-but-working save says nothing, short enough that nobody is left watching a ring. */
const LONG_ENOUGH_TO_BE_WORTH_SAYING = 8_000

export function useStillSending(busy: boolean, after: number = LONG_ENOUGH_TO_BE_WORTH_SAYING): boolean {
  return useLongerThan(busy, after)
}

// What the second half may say depends on the screen, and it is the half about his money. `Keep this screen open` was true everywhere when it was written and is no longer true of the day sheet: a sitting is kept on the device now and survives the tab being discarded, so telling him to keep it open there understates what the app does and asks him for something a phone does not let him promise.

// Said by the screen rather than worked out here, because only the screen knows whether what is typed into it is kept.

/** Said beside the button that is still sending, in the place a refusal would go. Nothing at all while a send is ordinary. */
export function StillSending({
  busy,
  after,
  keeps = false,
}: {
  busy: boolean
  after?: number
  /** Whether what is typed on this screen survives the app closing. */
  keeps?: boolean
}) {
  const stuck = useStillSending(busy, after)

  if (!stuck) {
    return null
  }

  return (
    // `status` rather than `alert`: nothing has gone wrong, and an alert interrupts what a screen reader is saying to announce that things are fine.
    <p className="text-muted-foreground text-sm" role="status">
      This has not gone in yet — it will as soon as the phone has signal.{' '}
      {keeps ? 'What you have typed is kept, even if this closes.' : 'Keep this screen open until it does.'}
    </p>
  )
}
