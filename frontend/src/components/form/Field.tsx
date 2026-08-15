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
  const [hasBeenLeft, setHasBeenLeft] = useState(false)
  const said = useId()

  const showing = hasBeenLeft && problem !== undefined && problem !== null && problem !== ''

  return (
    <label
      className={cn('flex flex-col gap-1.5', className)}
      // Focus leaving anything inside, which is what a blur is here. Once left, it stays left: what is wrong then follows every keystroke until it is right.
      onBlur={() => {
        setHasBeenLeft(true)
      }}
    >
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
