import { useEffect, useState } from 'react'

import { everythingKeptUnder, forgetOnThisDevice, keepOnThisDevice, whatWasKept } from '../../lib/keptOnThisDevice'
import type { Draft } from './sitting'
import { anEmptyDraft, sittingTotalPaisa } from './sitting'

// What a sitting is while it is being typed: the lines already put down, and the one still in the boxes.

// Both, because keeping only what is finished loses the line he was looking at when the phone locked -- which is the one he was in the middle of and the one he is least likely to remember.

/** A sitting held on the device, tied to the house and the day it belongs to: opening another house must never show somebody else's half-typed payment. */
export type TheSitting = { done: Array<Draft>; draft: Draft }

const UNDER = 'sitting:'

export function whereASittingIsKept(siteId: string, day: string): string {
  return `${UNDER}${siteId}:${day}`
}

/** A sitting somewhere on this device that has not gone in, said the way a row about it would be. */
export type StillWaiting = { keptUnder: string; siteId: string; day: string; entries: number; paisa: number }

// Which house and which day a key is about. The key is built two lines above, so this is the one reading it back -- and it is a `slice` rather than a `split` because a Convex id has no colon in it and a day has two, so splitting on colons gets the day wrong the moment anything else is ever kept this way.
function whatItIsAbout(keptUnder: string): { siteId: string; day: string } | null {
  const rest = keptUnder.slice(UNDER.length)
  const between = rest.indexOf(':')

  return between < 1 || between === rest.length - 1
    ? null
    : { siteId: rest.slice(0, between), day: rest.slice(between + 1) }
}

// Everything typed on this device and not yet posted, across every house and every day.

// The unposted work that gets lost is by definition on the house nobody is looking at, so anything meaning to say `you have work that has not gone in` has to ask all of them. It is the only reader of that store outside the screen that owns a sitting, and it reads rather than keeps.

// Entries and not keys. Three payments typed against one house is one key holding three rows, and `you have 3 that have not gone in` is the thing that can be lost -- `1 sitting` is a word he has never seen and a number that says nothing about how much work is at risk.
export function whatIsStillWaiting(): Array<StillWaiting> {
  const waiting: Array<StillWaiting> = []

  for (const keptUnder of everythingKeptUnder(UNDER)) {
    const about = whatItIsAbout(keptUnder)
    const sitting = aSittingWorthKeeping(whatWasKept(keptUnder))
    if (about === null || sitting === null) continue

    // The line still in the boxes counts when it carries an amount, and not merely when it has been touched.

    // Both halves matter. Counting it whenever anything is typed makes a picked category into `1 waiting, 0` -- a badge shouting about a keystroke, and a row in the list with a nought where the figure goes. Not counting it at all is worse: a payment typed in full and left when the phone locked is the line the keeping exists for, and the store's own comment says it is the one he is least likely to remember.

    // An amount is the line between them. A `done` row always has one, because it got past `whatIsMissingFromTheLine` to become one; the draft is counted on the same terms rather than on softer ones.
    const started = sitting.draft.amount.trim() !== ''
    const all = started ? [...sitting.done, sitting.draft] : sitting.done

    // Nothing to say about a key holding only a touch. `aSittingWorthKeeping` keeps it on purpose -- it is the line he was in the middle of and it comes back when he returns -- and it is not work anybody could lose the value of.
    if (all.length === 0) continue

    waiting.push({ ...about, keptUnder, entries: all.length, paisa: sittingTotalPaisa(all).paisa })
  }

  // Oldest first: the one furthest from being remembered is the one worth saying first.
  return waiting.sort((one, other) => one.day.localeCompare(other.day) || one.siteId.localeCompare(other.siteId))
}

/** How many entries are waiting altogether, which is what the rail's badge says. */
export function howManyAreWaiting(waiting: Array<StillWaiting>): number {
  return waiting.reduce((all, one) => all + one.entries, 0)
}

/** What was kept, if it is a sitting and there is anything in it. A sitting of nothing is the same as nothing kept: restoring it would say "picked up where you left off" to somebody who left off nowhere. */
export function aSittingWorthKeeping(kept: unknown): TheSitting | null {
  if (typeof kept !== 'object' || kept === null || !('done' in kept) || !('draft' in kept)) return null

  const { done, draft } = kept as { done: unknown; draft: unknown }
  if (!Array.isArray(done) || typeof draft !== 'object' || draft === null) return null

  const holding = done as Array<Draft>
  const typing = draft as Draft

  const anythingTyped =
    holding.length > 0 || typing.amount.trim() !== '' || typing.tradeId !== '' || typing.newPerson.trim() !== ''

  return anythingTyped ? { done: holding, draft: typing } : null
}

/** The sitting, kept on this device as it is typed and forgotten the moment it goes in. */
export function useTheSittingKept(under: string): {
  restored: TheSitting | null
  keep: (sitting: TheSitting) => void
  forget: () => void
} {
  // Read once, on the first render for this house and day. Read on every render it would fight what is being typed.
  const [restored] = useState(() => aSittingWorthKeeping(whatWasKept(under)))

  return {
    restored,
    keep: (sitting) => {
      keepOnThisDevice(under, sitting)
    },
    forget: () => {
      forgetOnThisDevice(under)
    },
  }
}

/** An empty sitting, which is what a day sheet opens on when nothing was kept. */
export function anEmptySitting(): TheSitting {
  return { done: [], draft: anEmptyDraft() }
}

// Kept as it is typed. Written on every change rather than on a timer: a phone locks between keystrokes, and there is no such thing as a good moment to have last saved.

// A sitting with nothing in it is forgotten rather than written. It used to be written, so every house and day anybody merely looked at left a key behind holding an empty sitting -- harmless on the way back, because `aSittingWorthKeeping` refuses it, and not harmless at all to anything that has to sweep the keys. A count of unposted work that counts the days somebody glanced at is a count of nothing.
export function useKeepingIt(under: string, sitting: TheSitting, keeping: boolean): void {
  useEffect(() => {
    if (!keeping) return

    if (aSittingWorthKeeping(sitting) === null) {
      forgetOnThisDevice(under)

      return
    }

    keepOnThisDevice(under, sitting)
  }, [under, sitting, keeping])
}
