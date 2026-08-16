import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'
import { Button as OnShadcn } from '../ui/button'

// Every button that sends something. Written once for the same reason the pointer cursor is: five screens each spelling out `disabled:opacity-50` is five chances to forget it, and the one that forgets is the one somebody presses twice.

// Built on shadcn's button rather than on a `<button>`. It was a `<button>` while `ui/button.tsx` sat in the tree imported by one file, which is the gap this closes: what comes with it is a focus ring, `asChild`, and one place that decides what a disabled button does -- and none of that was going to be written by hand five screens from now.

// Nauman: "for buttons submission use spinners". While it is sending, the button turns itself off, keeps its own label, and shows a turning ring beside it.
const LOOKS = {
  // What sends the form. One of these per screen. shadcn's `default`, whose hover this now has and did not.
  send: { variant: 'default' } as const,
  // Beside it, and never instead of it: cancel, or anything that undoes. shadcn's `outline` brings a filled background and a shadow that this never had, so both are taken back off -- a bordered button on this app shows what is behind it.
  beside: { variant: 'outline', undoing: 'bg-transparent shadow-none' } as const,
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
      // Never `submit`: nothing here is inside a `form`, and a stray submit reloads the page and loses everything typed. shadcn's button does not say this, so it is a `submit` the moment one of these ends up in a form somebody adds later.
      type="button"
      // Off while it is sending, so the same day sheet cannot go in twice.
      disabled={disabled || busy}
      // Said rather than only drawn, because a turning ring is nothing to a screen reader.
      aria-busy={busy || undefined}
      className={cn(ALWAYS, undoing, className)}
      {...rest}
    >
      {/* The ring's room is held on both sides at all times. So the label stays centred, and pressing the button neither resizes it nor shifts what it says under the finger still on it -- "Add them" becoming "Adding…" does both. */}
      <span aria-hidden className="size-4 shrink-0" />
      {children}
      {/* Wrapped, and that is the whole reason for the wrapper: `has-[>svg]:px-3` matches a *direct* child, so a bare ring here made every button in the app take shadcn's icon padding -- and a variant beats a plain `px-3` written at a call site, so "Bill it" on a stage row silently grew. A span between them makes the selector not match, and the padding is decided where it is written. */}
      <span aria-hidden className="inline-flex">
        <Loader2 className={cn('size-4 shrink-0 animate-spin', busy ? 'opacity-100' : 'opacity-0')} />
      </span>
    </OnShadcn>
  )
}
