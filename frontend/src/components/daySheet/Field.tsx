import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

// One question, asked once, with its answer under it. Anything that does not apply is not here at all rather than greyed out.
export function Field({
  label,
  hint,
  problem,
  children,
  className,
}: {
  label: string
  hint?: string
  problem?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">{label}</span>
      {children}
      {problem ? (
        <span className="text-destructive text-sm">{problem}</span>
      ) : hint ? (
        <span className="text-muted-foreground text-sm">{hint}</span>
      ) : null}
    </label>
  )
}

const CONTROL =
  'border-border bg-card text-foreground focus:border-primary focus:ring-primary/25 w-full rounded-none border-0 border-b-2 px-0 py-2.5 text-lg outline-none transition-colors focus:ring-0'

// Ruled like a line on the page rather than boxed, because eight of these boxed becomes a wall.
export function Picker({
  value,
  onChange,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select value={value} onChange={onChange} className={cn(CONTROL, 'appearance-none bg-none')} {...rest}>
      {children}
    </select>
  )
}

export function Line(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />
}

export function Lines(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={cn(CONTROL, 'resize-none', props.className)} />
}
