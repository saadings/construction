import { asAWeekday } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { Button } from '../form/Button'
import { Figure } from '../shell/Page'
import type { StillWaiting } from './theSittingKept'

// Everything typed on this device that has not gone in, wherever it was typed.

// It exists because of the badge rather than beside it. A count on the rail says `you have work that is not in the ledger` and then has to be able to say **where** -- and the work that gets lost is by definition on the house nobody is looking at, so there was nowhere for that count to point. A number somebody cannot reach is worse than no number: it names a loss and declines to locate it.

// Not in his drawing. His `Waiting to post` card is this house and this day, exactly as drawn, and this sits above it -- the count with its subject restored rather than a second version of his card.

// On the screen only when there is something in it. A block headed with what is unfinished, drawn on the days nothing is, is a block that stops being read.
export function WhatIsWaiting({
  waiting,
  hereNow,
  onOpen,
}: {
  waiting: Array<StillWaiting>
  /** Where the sheet underneath is pointed now. That one is on the screen already, so saying it again here is saying it twice. */
  hereNow: string
  onOpen: (one: StillWaiting) => void
}) {
  const elsewhere = waiting.filter((one) => one.keptUnder !== hereNow)

  if (elsewhere.length === 0) {
    return null
  }

  return (
    // No margin of its own. Where it sits on the page is the route's business -- the day sheet draws its own padding for the reason its own comment gives, and a block that carries page margin is a block that cannot be drawn anywhere else.

    // Found by the camera rather than by reading it: photographed alone, its `mt-4` put the screen 16px below the top of the picture, and what refuses that is the check asking whether a picture of a screen is the screen.
    <section className="border-brass/30 bg-brass-tint flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold">Typed here and not sent</h2>
        {/* Said in the words rather than as a bare count, because this is the one place the number is explained rather than shown. */}
        <p className="text-muted-foreground text-[0.8125rem]">On this device only. None of it is in the ledger yet.</p>
      </div>

      <ul className="divide-brass/15 flex flex-col divide-y">
        {elsewhere.map((one) => (
          <li key={one.keptUnder} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              {/* The day rather than the house's name, because nothing here has the names -- the sheet reads those and this is drawn above it. The house is named by the sheet the moment this is opened, which is the next thing that happens. */}
              <span className="text-sm font-medium">{asAWeekday(one.day)}</span>
              <span className="text-muted-foreground text-[0.75rem]">
                {one.entries} {one.entries === 1 ? 'entry' : 'entries'}
              </span>
            </span>

            <Figure className="text-brass text-sm whitespace-nowrap">{formatPaisa(one.paisa)}</Figure>

            {/* A way in and not a way out. Nothing here removes anything: what is kept is what he typed, and a control that throws it away is a control beside a sentence saying it is not in the ledger yet. */}
            <Button look="beside" className="shrink-0 whitespace-nowrap" onClick={() => onOpen(one)}>
              Open
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
