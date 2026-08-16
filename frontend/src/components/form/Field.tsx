import type { ReactNode } from 'react'
import { createContext, useContext, useId, useState } from 'react'

import { cn } from '../../lib/utils'
import { FieldDescription, FieldError, FieldLabel, Field as OnShadcn } from '../ui/field'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'

// What is wrong with one answer is said beside it the moment the eye leaves it, and never before: a form that argues while somebody is still typing is a form fighting the person filling it in.

// The rule is here rather than in each screen, so no screen can forget it and none of them can do it differently.

// Built on shadcn's `Field`, which is a group with a label pointing into it rather than a `<label>` wrapped round it. That is the better shape and it is why the wrapper is gone: a `<label>` names exactly one control, so a row of choices inside one announced its first choice as the field's own name -- found four times, and it needed a guard of its own to keep finding it. A group can hold what it likes and says what names it.
type Asked = { id: string | undefined; invalid: boolean; describedBy: string | undefined }

const InAField = createContext<Asked>({ id: undefined, invalid: false, describedBy: undefined })

// Read by the control inside, so it can take its name and say it is wrong without every screen wiring that up by hand. A screen that forgets an id is the failure this replaces, and no screen can forget one it never writes.
export function useWhatIsAsked(): Asked {
  return useContext(InAField)
}

// When a problem may be said: never while the answer is still being typed, always once focus has left, and from then on it follows every keystroke so it goes as soon as the answer is right.

// A hook rather than a rule inside `Field`, because the amount is not a `Field` -- it is set in the display face at the size of a headline -- and one rule in two shapes is how they stay the same rule.
export function useSaidOnceLeft(problem?: string | null): { showing: boolean; onBlur: () => void } {
  const [hasBeenLeft, setHasBeenLeft] = useState(false)

  return {
    showing: hasBeenLeft && problem !== undefined && problem !== null && problem !== '',
    onBlur: () => {
      setHasBeenLeft(true)
    },
  }
}

// How a question is written on this app: small, spaced and upper-case. shadcn's label is body text, and this is the one thing about the form that Nauman has already looked at and kept.

// Read by `Choices` too, which asks a question the same way and answers it with a row of boxes rather than a control.
export const ASKED = 'text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase'

/** Which shape a box wears. Named the way `Button` names its own, because they are the same idea. */
export type Look = 'asked' | 'beside' | 'amount'

export function Field({
  label,
  hint,
  problem,
  children,
  className,
}: {
  label: string
  hint?: string
  // What is wrong with the answer, worked out from the same rule the server refuses by. Handed in on every keystroke; shown only once focus has left.
  problem?: string | null
  children: ReactNode
  className?: string
}) {
  const named = useId()
  const said = useId()
  // Focus leaving anything inside, which is what a blur is here. It stays on the group rather than moving to the control, so a question answered by more than one box is still one question that has been left.
  const { showing, onBlur } = useSaidOnceLeft(problem)

  return (
    <OnShadcn data-invalid={showing || undefined} onBlur={onBlur} className={cn('gap-1.5', className)}>
      <FieldLabel htmlFor={named} className={ASKED}>
        {label}
      </FieldLabel>

      <InAField.Provider value={{ id: named, invalid: showing, describedBy: showing || hint ? said : undefined }}>
        {children}
      </InAField.Provider>

      {showing ? (
        <FieldError id={said}>{problem}</FieldError>
      ) : hint ? (
        <FieldDescription id={said}>{hint}</FieldDescription>
      ) : null}
    </OnShadcn>
  )
}

// A row of choices is asked the way `Field` asks a question and is not a `Field`: it lives in `Choices.tsx`, because what answers it is a group of boxes rather than one control, and every part of this file's machinery -- the id, the invalid flag, the problem said once focus has left -- is about naming a single control.

const LOOKS = {
  // The answer to a question: a line under it rather than a box round it, in the display size, because the figure is the thing being read.
  asked:
    'border-border bg-card focus:border-primary aria-invalid:border-destructive w-full rounded-none border-0 border-b-2 px-0 py-2.5 text-lg md:text-lg',
  // A box sitting inside something that is already drawn -- the day at the top of a sitting, the date beside a stage. It brings no rule and no room of its own, because what it sits in has both. It does bring a size: this look carried shadcn's `md:text-sm` at 14px, and the day picker is tapped on every entry of a day sheet.
  beside: 'rounded-none border-0 bg-transparent p-0 text-base md:text-base',
  // The amount, which is the one thing on a day sheet worth looking at. Its size is here rather than at the one place that asks for it because of the trap in the line below: shadcn's input is `text-base md:text-sm`, so a size written without its `md:` twin is the size somebody sees on a phone and not the size they see on a desk. Nobody here can open the app to notice a headline turning into 14px at 768px.
  amount:
    'font-display placeholder:text-muted-foreground/40 min-w-0 flex-1 rounded-none border-0 bg-transparent py-1 text-[2.75rem] leading-tight md:text-[2.75rem]',
} as const

// What is always undone, whichever look it wears. Each of these is one of shadcn's own defaults, and each is load-bearing: `h-auto` because theirs is a fixed 36px that clips text at this size, `shadow-none` because a shadow under a line with no box draws a box that is not there, and `focus-visible:ring-0` because a ring round a control with no border is a rectangle round nothing. Asserted as the outcome of the merge in the test beside this, not as words in a string.

// `w-full` is not here on purpose. It belongs to the look that fills a row; put in a box that is asked to take what is left, it is the `Rs` bug -- a control demanding the whole row while the label beside it gives way.
const ALWAYS = 'text-foreground h-auto shadow-none transition-colors outline-none focus-visible:ring-0'

// The floor every look has to clear, and the reason it is a floor rather than a preference. iOS Safari zooms the whole page when focus lands in a control set under 16px, and it does not zoom back: the person pinches out again, on every entry, on the screen he is in all day. Nothing in this repository can render, so it is asserted off the classes -- at the base size and at `md` separately, because a size written without its `md:` twin is the size on a phone and not the size on a desk. That is what put the day picker at 14px, on the one control this app is tapped on most.
export const NEVER_SMALLER_THAN = 16

export function Line({ look = 'asked', className, ...props }: React.ComponentProps<'input'> & { look?: Look }) {
  const asked = useWhatIsAsked()

  return (
    <Input
      id={asked.id}
      aria-invalid={asked.invalid || undefined}
      aria-describedby={asked.describedBy}
      {...props}
      className={cn(ALWAYS, LOOKS[look], className)}
    />
  )
}

export function Lines({ look = 'asked', className, ...props }: React.ComponentProps<'textarea'> & { look?: Look }) {
  const asked = useWhatIsAsked()

  return (
    <Textarea
      id={asked.id}
      rows={2}
      aria-invalid={asked.invalid || undefined}
      aria-describedby={asked.describedBy}
      {...props}
      className={cn(ALWAYS, LOOKS[look], 'min-h-0 resize-none', className)}
    />
  )
}
