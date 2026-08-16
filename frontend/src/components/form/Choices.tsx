import type { CSSProperties } from 'react'
import { useId } from 'react'

import { cn } from '../../lib/utils'
import { FieldDescription, FieldLabel, Field as OnShadcn } from '../ui/field'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { ASKED } from './Field'

// A question answered by picking one of a few, which on this app is a row of labelled boxes: `Cheque | Cash | Transfer | Pay order` on the day sheet, `Ours to sell | For a client` on a house. Six screens drew that row and every one of them drew it by hand, in the same twenty lines, with the same two class strings differing only in `py-2` against `py-2.5`.

// It is not `RadioGroup`. Theirs is a 16px circle with a dot in it, and this app's rows are boxes with words in them that he reads by shape and taps with a thumb -- swapping the control would be the conversion changing the app rather than what the app is made of, and 16px is 28px under the floor set for a thumb. `ToggleGroup` in single mode is shadcn's own segmented control and is the same shape as what is already drawn: Radix gives the items `role="radio"` and `aria-checked` itself, and the root a roving tabindex with arrow keys, which is the whole of what the hand-written version was missing.
type Choice<TChosen> = {
  /** What choosing it means to the screen. Anything at all: these rows pick strings, and two of them pick `true` or `false`. */
  is: TChosen
  /** What he reads. */
  said: string
}

export function Choices<TChosen>({
  label,
  onlySpoken = false,
  across,
  hint,
  chosen,
  choices,
  onChoose,
  className,
}: {
  label: string
  /** How many across on a phone, when one per choice is too many. Above `sm` it is always one per choice. */
  across?: number
  /** When the question is already on the screen in other words, or the choices are whole sentences that ask it themselves: `Part of what the house cost | Land, taxes and commission` needs no caption above it, and the label is written for the reader who hears it rather than the one who sees it. */
  onlySpoken?: boolean
  hint?: string
  chosen: TChosen
  choices: ReadonlyArray<Choice<TChosen>>
  onChoose: (chosen: TChosen) => void
  className?: string
}) {
  const said = useId()

  // Radix carries the answer as a string, and two of these rows answer `true` or `false`. So what travels is the position in the row, and the answer is looked up in the list it was drawn from -- the same shape a picker uses here, and the reason a boolean row needs no special case.
  const at = choices.findIndex((choice) => choice.is === chosen)

  return (
    <OnShadcn className={cn('gap-1.5', className)}>
      {/* Not a `<label>` and not a `Field`: a label names exactly one control, so the first box in a row took the question's words as its own name and "Cheque" announced itself as "How paid". A group can hold what it likes and says what names it. */}
      <FieldLabel id={said} className={onlySpoken ? 'sr-only' : ASKED}>
        {label}
      </FieldLabel>

      <ToggleGroup
        type="single"
        variant="outline"
        // Radix's own root is `role="group"` even in single mode, while its items are `role="radio"` -- and a radio owned by a group rather than a radiogroup is a control a screen reader cannot count. This is passed through their spread, which is after their own role, so it is theirs to allow rather than ours to force.
        role="radiogroup"
        aria-labelledby={said}
        // Their default is 0, which is the joined segmented look: square inner corners and no border between. These are separate boxes with a gap, which is what all six screens already drew.
        spacing={2}
        value={at === -1 ? '' : String(at)}
        onValueChange={(picked) => {
          // Pressing the chosen one again un-chooses it in Radix, and hands back ''. There is no un-answering a question here -- no payment was made by no method. Written before the lookup on purpose: `Number('')` is 0, not `NaN`, so a missing answer would otherwise read as the first choice.
          if (picked === '') return

          // `.at` rather than an index, so a position this row does not hold is `undefined` rather than something TypeScript will insist is a choice.
          const choice = choices.at(Number(picked))
          if (choice !== undefined) onChoose(choice.is)
        }}
        // One column per choice, unless a screen says otherwise for a phone: `A partner put it in` three across at 390px is three lines of text in a 118px box. Written as two variables rather than a lookup from a count to a class name, because a lookup has keys and a row of five choices would quietly fall out of it.

        // `items-stretch` because theirs is `items-center`, and it survives the change from a flex row to a grid: `A rate per square foot` wraps onto two lines and the box beside it did not grow with it, so one sat 14px shorter than the other with a gap above and below. Nothing in the diff said so and the picture did.
        className="grid w-full items-stretch grid-cols-[repeat(var(--across),minmax(0,1fr))] sm:grid-cols-[repeat(var(--across-sm),minmax(0,1fr))]"
        style={{ '--across': across ?? choices.length, '--across-sm': choices.length } as CSSProperties}
      >
        {choices.map((choice, index) => (
          <ToggleGroupItem
            key={choice.said}
            value={String(index)}
            // `min-h-11` is the 44px floor, which these rows have never met: they were `py-2` and `py-2.5`, so 36px and 40px, on the control a day sheet is tapped on four times per entry. `whitespace-normal` undoes shadcn's `nowrap`, because "Pay order" in a quarter of a 390px screen has to wrap rather than run out of its box.
            className="text-muted-foreground h-auto min-h-11 w-auto rounded-md border-border px-3 py-2.5 text-sm font-normal whitespace-normal shadow-none data-[state=on]:border-primary data-[state=on]:font-medium"
          >
            {choice.said}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </OnShadcn>
  )
}
