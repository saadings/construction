import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

// Every button that sends something. Written once for the same reason the pointer cursor is: five screens each spelling out `disabled:opacity-50` is five chances to forget it, and the one that forgets is the one somebody presses twice.

// Nauman: "for buttons submission use spinners". While it is sending, the button turns itself off, keeps its own label, and shows a turning ring beside it.
const LOOKS = {
  // What sends the form. One of these per screen.
  send: 'bg-primary text-primary-foreground',
  // Beside it, and never instead of it: cancel, or anything that undoes.
  beside: 'border-border text-foreground border',
} as const

const ALWAYS =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-medium disabled:opacity-50 disabled:cursor-default'

export function Button({
  busy = false,
  look = 'send',
  disabled = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; look?: keyof typeof LOOKS }) {
  return (
    <button
      // Never `submit`: nothing here is inside a `form`, and a stray submit reloads the page and loses everything typed.
      type="button"
      // Off while it is sending, so the same day sheet cannot go in twice.
      disabled={disabled || busy}
      // Said rather than only drawn, because a turning ring is nothing to a screen reader.
      aria-busy={busy || undefined}
      className={cn(ALWAYS, LOOKS[look], className)}
      {...rest}
    >
      {/* The ring's room is held on both sides at all times. So the label stays centred, and pressing the button neither resizes it nor shifts what it says under the finger still on it -- "Add them" becoming "Adding…" does both. */}
      <span aria-hidden className="size-4 shrink-0" />
      {children}
      <Loader2 aria-hidden className={cn('size-4 shrink-0 animate-spin', busy ? 'opacity-100' : 'opacity-0')} />
    </button>
  )
}
