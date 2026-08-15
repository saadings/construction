import type { ReactNode } from 'react'
import { createContext, useContext, useId, useState } from 'react'

import { cn } from '../../lib/utils'

// What is wrong with one answer is said beside it the moment the eye leaves it, and never before: a form that argues while somebody is still typing is a form fighting the person filling it in.

// The rule is here rather than in each screen, so no screen can forget it and none of them can do it differently.
type Asked = { invalid: boolean; describedBy: string | undefined }

const InAField = createContext<Asked>({ invalid: false, describedBy: undefined })

// Read by the control inside, so it can say it is wrong without every screen wiring that up by hand.
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
  const said = useId()
  // Focus leaving anything inside, which is what a blur is here.
  const { showing, onBlur } = useSaidOnceLeft(problem)

  return (
    <label className={cn('flex flex-col gap-1.5', className)} onBlur={onBlur}>
      <span className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">{label}</span>

      <InAField.Provider value={{ invalid: showing, describedBy: showing || hint ? said : undefined }}>
        {children}
      </InAField.Provider>

      {showing ? (
        <span id={said} role="alert" className="text-destructive text-sm">
          {problem}
        </span>
      ) : hint ? (
        <span id={said} className="text-muted-foreground text-sm">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

// A row of choices, asked the way `Field` asks a question but not wrapped in a `<label>`.

// A label points at one control, and the first control inside it takes the label's words as its own name -- so inside a `Field`, the first choice in a row announces itself as "How paid How paid" and cannot be found by what is written on it. A screen reader reads exactly what the test could not find.
export function Choices({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  const said = useId()

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={said} className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">
        {label}
      </span>

      <div role="radiogroup" aria-labelledby={said}>
        {children}
      </div>

      {hint ? <span className="text-muted-foreground text-sm">{hint}</span> : null}
    </div>
  )
}

const CONTROL =
  'border-border bg-card text-foreground focus:border-primary focus:ring-primary/25 aria-invalid:border-destructive w-full rounded-none border-0 border-b-2 px-0 py-2.5 text-lg outline-none transition-colors focus:ring-0'

// Ruled like a line on the page rather than boxed, because eight of these boxed becomes a wall.
export function Picker({
  value,
  onChange,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const asked = useWhatIsAsked()

  return (
    <select
      value={value}
      onChange={onChange}
      aria-invalid={asked.invalid || undefined}
      aria-describedby={asked.describedBy}
      className={cn(CONTROL, 'appearance-none bg-none')}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Line(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const asked = useWhatIsAsked()

  return (
    <input
      aria-invalid={asked.invalid || undefined}
      aria-describedby={asked.describedBy}
      {...props}
      className={cn(CONTROL, props.className)}
    />
  )
}

export function Lines(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const asked = useWhatIsAsked()

  return (
    <textarea
      rows={2}
      aria-invalid={asked.invalid || undefined}
      aria-describedby={asked.describedBy}
      {...props}
      className={cn(CONTROL, 'resize-none', props.className)}
    />
  )
}
