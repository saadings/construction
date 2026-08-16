import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

// Every way out of something already put in: a payment taken back out of a sitting, a receipt off what has come in, an invitation off the list, a line off a bill.

// Written once because it was written nine times. Six were underlined, three were plain grey text, and nothing chose either -- an underline is an affordance and grey text is not, so a control that removes a row was reading as a caption on three screens.

// Not a `Button`. That one is what sends a form: filled or bordered, with room for a turning ring beside its label. A way out sits inside a row it belongs to, next to what it would remove, and has to look like a thing to press without looking like the thing to press.
const ALWAYS = 'text-muted-foreground hover:text-foreground text-sm underline underline-offset-4'

export function WayOut({
  busy = false,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      // Never `submit`: nothing here is inside a `form`, and a stray submit reloads the page and loses everything typed.
      type="button"
      // Off while it is going, for the reason `Button` is: pressing a way out twice is worse than pressing a send twice, because the second press lands on whatever row took the first one's place.
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(ALWAYS, 'disabled:cursor-default disabled:opacity-50', className)}
      {...rest}
    >
      {children}
    </button>
  )
}
