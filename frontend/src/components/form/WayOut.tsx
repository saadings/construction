import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'
import { Button as OnShadcn } from '../ui/button'

// Every way out of something already put in: a payment taken back out of a sitting, a receipt off what has come in, an invitation off the list, a line off a bill.

// Written once because it was written nine times. Six were underlined, three were plain grey text, and nothing chose either -- an underline is an affordance and grey text is not, so a control that removes a row was reading as a caption on three screens.

// Not a `Button`. That one is what sends a form: filled or bordered, with room for a turning ring beside its label. A way out sits inside a row it belongs to, next to what it would remove, and has to look like a thing to press without looking like the thing to press.

// Both are now shadcn's button underneath, which is the only thing this change is: `link` is what shadcn calls a control drawn as text, and it brings the focus ring and the disabled behaviour that were written out by hand here.

// Its defaults are undone one at a time and each is load-bearing. `text-primary` because a way out is not the thing to press, and the whole reason this exists is that three of them read as captions and six did not. `hover:underline` because shadcn underlines on hover and this underlines always -- an affordance that appears only once the pointer is on it is no affordance on a phone, where there is no pointer at all. `font-medium` because a way out must not be the boldest text on the row it sits in.

// The size and the shape, because shadcn's is a 36px pill with its own padding and this sits on a line of text. `inline` rather than their `inline-flex` for the same reason and a sharper one: an inline-flex box takes its baseline from the flex line inside it, which sat every row one of these is on a pixel off and moved the whole page under it.

// `whitespace-normal` and `shrink` for the reason `Button` has them: shadcn's are `whitespace-nowrap shrink-0`, and a way out sits at the end of a row beside the thing it removes, where refusing to wrap or to give way pushes the row wider than the screen instead.

// `py-3 -my-3` is what makes a thumb able to hit it, and the pair is the whole trick. Measured at 390, **thirteen of the thirteen controls in this app that remove something were 20px high** -- less than half of what a thumb needs, on the controls where a mis-tap costs a row somebody has to remember to re-enter.

// The padding grows the box a finger lands on to 44; the negative margin takes the same amount back out of the layout, so nothing on any row moves. The floor is about **tappable area, not visible size** -- said here because a rule read as "44px tall" is one somebody argues an exemption out of the first time it would double the height of a dense table, and this needs no exemption at all.
const ALWAYS =
  'text-muted-foreground hover:text-foreground inline h-auto shrink px-0 py-3 -my-3 has-[>svg]:px-0 text-sm font-normal whitespace-normal underline underline-offset-4 disabled:cursor-default'

export function WayOut({
  busy = false,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <OnShadcn
      variant="link"
      // Said on the control rather than worked out from its class list, so the thing that measures tap targets can ask the page which controls remove something and get an answer the page itself gives. A probe that infers what a control is from how it looks agrees with its own guess; this one cannot.
      data-removes=""
      // Never `submit`: nothing here is inside a `form`, and a stray submit reloads the page and loses everything typed.
      type="button"
      // Off while it is going, for the reason `Button` is: pressing a way out twice is worse than pressing a send twice, because the second press lands on whatever row took the first one's place.
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(ALWAYS, className)}
      {...rest}
    >
      {children}
    </OnShadcn>
  )
}
