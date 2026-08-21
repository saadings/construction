import { useEffect, useState } from 'react'

import { forgetOnThisDevice, keepOnThisDevice, whatWasKept } from '../../lib/keptOnThisDevice'
import type { Draft } from './sitting'
import { anEmptyDraft } from './sitting'

// What a sitting is while it is being typed: the lines already put down, and the one still in the boxes.

// Both, because keeping only what is finished loses the line he was looking at when the phone locked -- which is the one he was in the middle of and the one he is least likely to remember.

/** A sitting held on the device, tied to the house and the day it belongs to: opening another house must never show somebody else's half-typed payment. */
export type TheSitting = { done: Array<Draft>; draft: Draft }

export function whereASittingIsKept(siteId: string, day: string): string {
  return `sitting:${siteId}:${day}`
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
