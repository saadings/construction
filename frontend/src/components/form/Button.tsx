import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'
import { ROOM_FOR_A_THUMB } from '../roomForAThumb'
import { Button as OnShadcn } from '../ui/button'

// Every button that sends something. Written once for the same reason the pointer cursor is: five screens each spelling out `disabled:opacity-50` is five chances to forget it, and the one that forgets is the one somebody presses twice.

// Built on shadcn's button rather than on a `<button>`. It was a `<button>` while `ui/button.tsx` sat in the tree imported by one file, which is the gap this closes: what comes with it is a focus ring, `asChild`, and one place that decides what a disabled button does -- and none of that was going to be written by hand five screens from now.

// Nauman: "for buttons submission use spinners". While it is sending, the button turns itself off, keeps its own label, and shows a turning ring beside it.
const LOOKS = {
  // What sends the form. One of these per screen. shadcn's `default`, whose hover this now has and did not.
  send: { variant: 'default' } as const,
  // Beside it, and never instead of it: cancel, or anything that undoes. shadcn's `outline` brings a filled background and a shadow that this never had, so both are taken back off -- a bordered button on this app shows what is behind it.
  beside: { variant: 'outline', undoing: 'bg-transparent shadow-none' } as const,

  // Something more, said as text rather than as a box: `Add a line`, `Change`, `Pay it more than one way`. It sits inside what it adds to, and a box round it would compete with the send below it -- so it is the primary colour and no underline, which is what six screens had each written out by hand.

  // Not a `WayOut`, which is the same shape pointing the other way: this one puts something in.

  // And it went without `ROOM_FOR_A_THUMB` for exactly that reason. `WayOut` had the trick and the paragraph explaining it; this one is the same shape, drawn as text on a line in the same manner, two files away -- and `Add a line`, `Change` and `Split payment` were 20px high, with four row expanders on `What it went on` beside them.
  another: { variant: 'link', undoing: `text-primary h-auto ${ROOM_FOR_A_THUMB} text-sm no-underline` } as const,

  // The press that actually removes something, and the only red in this list.

  // Never the step that *opens* an are-you-sure. `oneWayOut` states that in words -- red belongs to the step that removes rather than to the thing somebody hits by accident -- and both screens that had one did the opposite, with `Put this house away` red and the confirmation under it grey. Those two openers are `WayOut` now, and this is where their colour went.

  // `ROOM_FOR_A_THUMB` for the reason `WayOut` has it, and now out of the same place as `WayOut` has it.
  removing: {
    variant: 'link',
    undoing: `text-destructive h-auto ${ROOM_FOR_A_THUMB} text-sm no-underline`,
  } as const,
}

// What is undone whichever look it wears, and each is one of shadcn's own defaults. `text-base` because theirs is `text-sm`, which is 14px on a control this app is pressed on all day; `h-auto` because theirs is a fixed 36px that cuts the padding below off. The padding and the size are this app's and are older than the wrapper -- rebuilding what a button is made of is not a decision to make its buttons a different shape.

// `has-[>svg]:px-5` is the one that was caught by looking rather than by thinking, and it is the same trap the day picker fell into: shadcn puts its padding behind a `has-` variant for a button with an icon in it, every one of these holds a turning ring, and `cn` does not merge a plain `px-5` over a variant of it. So the padding silently became 12px, which gave the day sheet's bottom bar enough room to put "Add another" and "Put them in" on one line each instead of two and took 24px off the height of the whole screen -- 8% of that picture, out of a change that was supposed to alter nothing anybody sees.

// It looked better, which is exactly why it was not this change's to make. What that bar does with a longer label at 390 is the bar's decision.

// `whitespace-normal` and `shrink` are here for the same reason and were merged correctly without being noticed: shadcn's are `whitespace-nowrap shrink-0`, and a button that refuses to wrap or to give way overflows the row instead of shortening it.
const ALWAYS =
  'h-auto shrink rounded-md px-5 py-3 text-base font-medium whitespace-normal has-[>svg]:px-5 disabled:cursor-default'

export function Button({
  busy = false,
  look = 'send',
  disabled = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; look?: keyof typeof LOOKS }) {
  const { variant, undoing } = { undoing: '', ...LOOKS[look] }

  return (
    <OnShadcn
      variant={variant}
      // Said on the control rather than worked out from its class list, so what measures tap targets can ask the page which controls remove something. `removing` is the press that takes a row out; `WayOut` says the same of itself. A probe that infers what a control is from how it looks agrees with its own guess.
      data-removes={look === 'removing' ? '' : undefined}
      // Never `submit`: nothing here is inside a `form`, and a stray submit reloads the page and loses everything typed. shadcn's button does not say this, so it is a `submit` the moment one of these ends up in a form somebody adds later.
      type="button"
      // Off while it is sending, so the same day sheet cannot go in twice.
      disabled={disabled || busy}
      // Said rather than only drawn, because a turning ring is nothing to a screen reader.
      aria-busy={busy || undefined}
      className={cn(ALWAYS, undoing, className)}
      {...rest}
    >
      {/* The ring's room is held on both sides at all times, so the label stays centred and pressing the button neither resizes it nor shifts what it says under the finger still on it -- "Add them" becoming "Adding…" does both. */}

      {/* Only for a look whose label is centred in a box of its own. A text action sits at the start of a row of other words, and holding 16px in front of it indents it away from everything it lines up with: the first picture of this sweep showed every trade name on `What it went on` moved 18px right, with nothing else on the screen following. Nothing is centred there, so nothing needs balancing -- the ring appears after the words and shifts none of them. */}
      {look === 'send' || look === 'beside' ? <span aria-hidden className="size-4 shrink-0" /> : null}
      {children}
      {/* Wrapped, and that is the whole reason for the wrapper: `has-[>svg]:px-3` matches a *direct* child, so a bare ring here made every button in the app take shadcn's icon padding -- and a variant beats a plain `px-3` written at a call site, so "Bill it" on a stage row silently grew. A span between them makes the selector not match, and the padding is decided where it is written. */}
      <span aria-hidden className="inline-flex">
        <Loader2 className={cn('size-4 shrink-0 animate-spin', busy ? 'opacity-100' : 'opacity-0')} />
      </span>
    </OnShadcn>
  )
}
