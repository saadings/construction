import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import type { Named } from './Trail'
import { Trail } from './Trail'

// What every screen sits in. The padding is here so six screens cannot each invent their own, and there is no width cap: a table of payments is the reason a desk is wider than a phone.

// The trail is here for the same reason, and it is why a screen drawing its own layout has to ask for one: on a phone the nav is behind a hamburger, so without this there is nothing on the screen saying where you are or how to get back.
export function Page({
  title,
  said,
  beside,
  named,
  children,
}: {
  title: string
  // What this screen is, in a sentence, which every drawn screen has under its title. Capped at the width a line of prose is read at rather than at the page's, because the table under it is deliberately uncapped.

  // Markup rather than a string, because a house says what it is in a line that carries a stage pill: `Building · For the buyer · 5,400 sqft · Started 4 January 2026`. Every other screen hands it a sentence, and both go in the same place under the same cap.
  said?: ReactNode
  beside?: ReactNode
  // What a `$param` in this screen's address is really called. The router knows there is a house; only the screen knows it is `1-A, Phase 0`.
  named?: Named
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 lg:px-9">
      <div className="flex flex-col gap-2">
        <Trail named={named} />

        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-foreground text-[2rem] leading-none sm:text-[2.5rem]">{title}</h1>
          {beside}
        </header>

        {said === undefined ? null : <p className="text-muted-foreground max-w-[64ch] text-sm">{said}</p>}
      </div>
      {children}
    </div>
  )
}

// A form reads badly at 1440px: the eye loses the line between a label and the box it belongs to. So a form is capped inside the content rather than the page being capped around it.
export function Form({
  className,
  children,
  freshAfter = 0,
}: {
  className?: string
  children: ReactNode
  // How many times this form has been sent. Every `Field` remembers on its own whether focus has ever left it, so it can hold its tongue while somebody is still typing, and emptying the boxes does not empty that: an emptied box that has been left reads as an answer somebody deleted, so the form turns red under a name that has just gone in perfectly well. Nauman read that as a failure and pressed Add again, and there were two of him. Counting up here makes the whole form new, which is what a reset is -- it forgets what was typed and it forgets having been visited.
  freshAfter?: number
}) {
  return (
    <div key={freshAfter} className={cn('flex w-full max-w-2xl flex-col gap-6', className)}>
      {children}
    </div>
  )
}

// Every figure in the app: the mono face and lining digits are what make a column of amounts read as a column rather than as a list of different-width strings.
export function Figure({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('font-mono tabular-nums', className)}>{children}</span>
}

// What the word `Hide` used to carry on its own. Five screens take a row off a list and every one of them is a signed soft hide -- `removed: true` with who and when -- so nothing is destroyed and the record answers for itself forever.

// Nobody was told that. Grepped for the copy expecting to find it: it is a **comment** on five screens of six, and a comment ships to nobody. The one above the old `Hide it?` even called that label *said plainly*, which is the author doing the job in the only place then available.

// So renaming to `Remove` without this would have taken the only reassurance out of the product and left it true in source, where the person worried about losing a payment cannot read it -- worse than the folksy label it replaced.

// `record` is not in it, and that is not a stylistic choice: two screens hold a rule refusing the words that are the machine showing through, and `record` is on that list. A sentence written to reassure him that fails the app's own no-jargon rule is the wrong sentence.

/** Said at the moment somebody is deciding, which is when they need it, rather than carried permanently by a word. */
export function NothingIsDeleted({ className }: { className?: string }) {
  return (
    <span data-nothing-is-deleted="" className={cn('text-muted-foreground block text-sm', className)}>
      It comes off this screen. What was entered stays, with who removed it and when.
    </span>
  )
}

// The quiet line under a name: a day, how it was paid, a cheque number, a note. Written once because it was written twice and only one of the two could be read.

// At 390 the other one rendered `27/06/2026 · CH…` -- two characters of the cheque number, on the screen where somebody checks which cheque paid which bill, and the number appears nowhere else on it. A name cut short is still recognisable; a cheque number cut short is not a cheque number.

// So it wraps rather than truncates. Reordering only chooses which of the four gets cut, and dropping one is deciding for him which he wanted.

// Each piece is held on a line of its own, which took a second picture to find: wrapping alone put `CH-114` across two lines as `CH-` and `114`, because a browser breaks at a hyphen. A cheque number in two halves is no better than a cheque number in two characters.

/** Said on the element rather than worked out from its classes, so what measures the columns can ask the page which text must never be cut. */
export const MUST_BE_READ = 'data-must-be-read'

export function SaidUnderneath({ pieces, className }: { pieces: Array<string | undefined>; className?: string }) {
  const said = pieces.filter((piece) => piece !== undefined && piece !== '')

  // A `span` rather than a `p`, and drawn as a block: one of the four places this goes sits inside a row that also holds a way out, and a paragraph nested in a span is markup a browser rearranges under you.
  return (
    <span {...{ [MUST_BE_READ]: '' }} className={cn('text-muted-foreground block text-sm', className)}>
      {said.map((piece, at) => (
        // The separator sits outside the span on purpose, so it is the one place the line may break -- and so each piece's own text is the piece, with nothing to strip off it before it can be read or asserted.
        <Fragment key={piece}>
          {at === 0 ? '' : ' · '}
          <span className="whitespace-nowrap">{piece}</span>
        </Fragment>
      ))}
    </span>
  )
}
