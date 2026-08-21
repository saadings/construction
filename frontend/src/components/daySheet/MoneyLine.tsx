import { groupWhileTyping } from '~shared/money'

import { Field, Line } from '../form/Field'

// The amount is the one thing on this screen worth looking at, so it is set in the display face at the size of a headline.

// A phone keyboard opens on digits, and the commas arrive as they are typed rather than when the payment is saved.

// It used to write its own label, its own alert and its own "say nothing until the eye has left" rule, because a `Field` was a `<label>` wrapped round one control and this is a control with a word beside it. A `Field` is a group now, so it holds the pair and this keeps only what is different: the face, the size, and the `PKR`.
export function MoneyLine({
  value,
  onChange,
  problem,
}: {
  value: string
  onChange: (typed: string) => void
  problem?: string | null
}) {
  return (
    <Field label="Amount" problem={problem}>
      <div className="border-border focus-within:border-primary flex items-baseline gap-2 border-b-2 transition-colors">
        {/* Never allowed to give up its width. It was two characters beside a box that asks for all of them, so flex took the space out of the label and broke `Rs` over two lines at desk width. `shrink-0` is what stopped that and is what makes a third character safe: a label that cannot be squeezed cannot be squeezed harder. */}

        {/* Beside the box rather than lifted over it, unlike every other amount field. This one is not a box -- it is a headline on a baseline rule, which is its own deviation from the drawing and older than this word. A prefix printed across a 44px figure would be a different field, not a renamed one. */}
        <span className="text-muted-foreground font-display shrink-0 text-2xl leading-none">PKR</span>
        {/* The `amount` look is where the face and the size live, and where `flex-1` says what is meant -- take what is left -- rather than `w-full`, which asks for the whole row and leaves the `PKR` beside it to give way. */}
        <Line
          look="amount"
          value={value}
          onChange={(event) => onChange(groupWhileTyping(event.target.value))}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
        />
      </div>
    </Field>
  )
}
