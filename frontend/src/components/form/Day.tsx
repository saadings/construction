import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { asCalendarDate, asDayHeWrites, isCalendarDate } from '~shared/calendarDate'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Field, useWhatIsAsked } from './Field'

// One way to pick a day in this app. Every screen used `<Line type="date" />`, which is an input the browser draws: a grey OS field with a calendar glyph in it, at its own size, in its own colours, and no CSS here reaches any of it. Nauman sent a screenshot of one and asked why the app is not shadcn throughout when he had said it should be.

// The same shape as `Pick`, deliberately: label, hint, problem, a value and one callback. A second convention for asking a question is how two screens come to ask it two ways.

// A day is `YYYY-MM-DD` everywhere here -- a calendar day rather than a moment -- and the calendar works in `Date`. Both conversions are local on purpose. `new Date('2026-07-04')` is parsed as UTC midnight, which in Lahore is already the 4th but west of Greenwich is the 3rd, and `toISOString()` going back is the same mistake in the other direction. A ledger that moved a payment to the day before depending on where somebody stood would be a hard defect to see and a worse one to explain.

// Which is why only one of the two is written here. Going the other way -- a moment read as the day it falls on -- is `asCalendarDate`, and it was already in `shared` under `todayOnThisDevice`; a second one beside it would be a second answer to ask, and this is not a question anybody should be able to get two answers to.

/** A `YYYY-MM-DD` day as a date in the reader's own timezone, or nothing if it is not one. */
export function theDayIn(value: string): Date | undefined {
  // Asked of the same rule the server refuses by, which already knows that the 31st of February is not a day. Left to `new Date(2026, 1, 31)` it would answer the 3rd of March rather than refuse.
  if (!isCalendarDate(value)) return undefined

  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day)
}

// What is shown on the button when a day is chosen. Written the way he writes one rather than the way it is stored, and `asDayHeWrites` rather than a format string here: this said `16 Aug 2026` for one day and seven screens said `2026-06-02`, which is three orders for one thing across an app whose whole job is that the figures agree.
function asWords(value: string): string | undefined {
  return isCalendarDate(value) ? asDayHeWrites(value) : undefined
}

// What is always undone, whichever look it wears, and each of these is one of shadcn's button defaults: `h-auto` because theirs is a fixed 36px that clips at this size, and `font-normal` because an answer is not a command. The size is not here -- it is in each look, the way `Field` keeps its own, because the two looks are set to two different sizes and both have to be written down rather than left to shadcn's `text-sm`.
const ALWAYS = 'justify-between font-normal h-auto'

/** Asked as a question in a form, or sitting inside a row that is already drawn. */
const LOOKS = {
  // The same shape as `Line`'s `asked`, to the class: a line under the answer rather than a box round it, in the display size. Not shadcn's outlined button, which is what this was first, and which put one bordered rounded box in a column of five underlined ones on the extra-work form -- the same question asked in two visual languages on one screen. `ghost` rather than `outline` so there is no box to undo, and `hover:bg-card` because a ghost's own hover fills the whole answer with the accent and no box beside it does that.
  asked: {
    variant: 'ghost',
    classes:
      // `has-[>svg]:px-0` as well as `px-0`: shadcn's button sets its own padding behind a `has-` variant for exactly the case this is -- something with an icon in it -- and `cn` does not merge a plain utility over a variant of it, so the day sat a few pixels right of every other answer in the column.
      'border-border bg-card hover:bg-card focus-visible:border-primary aria-invalid:border-destructive w-full rounded-none border-0 border-b-2 px-0 py-2.5 text-lg has-[>svg]:px-0',
  },
  // Kept as a bordered button, unlike `Line`'s `beside`, which brings no border at all. A box you type into shows what it is by having a caret in it; this one shows nothing until it is tapped, and in a stage's row it sits beside "Bill it" where an unbordered date would read as text somebody had already entered. The room it brings is small because the row it is in has its own.
  beside: { variant: 'outline', classes: 'w-auto px-2 py-2.5 text-base' },
} as const

export function Day({
  label,
  hint,
  problem,
  value,
  onPick,
  look = 'asked',
}: {
  /** What it is called. Shown above the control unless the look says otherwise, and always what it announces itself as.  */
  label: string
  hint?: string
  problem?: string | null
  /** `YYYY-MM-DD`, or empty for a day nobody has chosen yet. */
  value: string
  onPick: (day: string) => void
  look?: keyof typeof LOOKS
}) {
  return look === 'beside' ? (
    <TheDay label={label} value={value} onPick={onPick} look={look} />
  ) : (
    <Field label={label} hint={hint} problem={problem}>
      <TheDay label={label} value={value} onPick={onPick} look={look} />
    </Field>
  )
}

// Its own component only so that it is inside the `Field` and can read what the field is asking. The id is the whole reason: `Field` draws a label pointing at one, nothing here carried it, and tapping the words above every date in the app did nothing at all. On a phone those words are a bigger target than the control under them.

// Read outside a `Field` too, when the look is `beside` -- and the answer there is the empty one every context has, so the control carries no id and no label points at it. That is right rather than a gap: a date sitting in a stage's row has no label of its own to be pointed at.
function TheDay({
  label,
  value,
  onPick,
  look,
}: {
  label: string
  value: string
  onPick: (day: string) => void
  look: keyof typeof LOOKS
}) {
  const [open, setOpen] = useState(false)
  const asked = useWhatIsAsked()
  const chosen = theDayIn(value)
  const said = asWords(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={asked.id}
          aria-invalid={asked.invalid || undefined}
          aria-describedby={asked.describedBy}
          variant={LOOKS[look].variant}
          // Always named, even where there is no label above it: in a row of stages the visible words belong to the stage, and a screen reader would otherwise be handed a date with nothing saying which one.
          aria-label={said === undefined ? `${label}: no day chosen` : `${label}: ${said}`}
          className={cn(ALWAYS, LOOKS[look].classes)}
        >
          {said ?? <span className="text-muted-foreground">Pick a day</span>}
          <CalendarDays className="size-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={chosen}
          defaultMonth={chosen}
          onSelect={(picked) => {
            if (picked === undefined) return

            onPick(asCalendarDate(picked))
            // Closed behind the pick, because a calendar left open over the next question is two actions where there was one, and the second is the one forgotten with a cheque book in the other hand.
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
