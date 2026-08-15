import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

// What every screen sits in. The padding is here so six screens cannot each invent their own, and there is no width cap: a table of payments is the reason a desk is wider than a phone.
export function Page({ title, beside, children }: { title: string; beside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 lg:px-9">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-foreground text-[2rem] leading-none sm:text-[2.5rem]">{title}</h1>
        {beside}
      </header>
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
