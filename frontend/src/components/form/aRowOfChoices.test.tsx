// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { Choices } from './Choices'

afterEach(cleanup)

// What a row of choices does under a keyboard, asked before it was converted and kept as the record of what converting bought.

// It is not `RadioGroup`. Theirs is a 16px circle with a dot in it, and this app's rows are labelled boxes -- `Cheque | Cash | Transfer | Pay order` on the day sheet, which he reads by shape and taps all day. Swapping the control would be the conversion changing the app rather than what the app is made of, and a 16px circle is 28px under the floor set for a thumb. `ToggleGroup` in single mode is shadcn's own segmented control, and Radix gives its items `role="radio"` itself.
const HOW = [
  { is: 'cheque', said: 'Cheque' },
  { is: 'cash', said: 'Cash' },
  { is: 'transfer', said: 'Transfer' },
  { is: 'payOrder', said: 'Pay order' },
]

function ARowOfChoices({ start = 'cheque' }: { start?: string }) {
  const [chosen, setChosen] = useState(start)

  return <Choices label="How paid" chosen={chosen} choices={HOW} onChoose={setChosen} />
}

describe('a row of choices as this app writes one', () => {
  it('is a group that says what it is asking', () => {
    render(<ARowOfChoices />)

    // Radix's own root is `role="group"` even in single mode while its items are `role="radio"`, so this is the app overriding it. If a version of theirs stops letting that through, this is what says so.
    expect(screen.getByRole('radiogroup', { name: 'How paid' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('says which one is chosen, and only that one', () => {
    render(<ARowOfChoices />)

    const chosen = screen.getAllByRole('radio').filter((one) => one.getAttribute('aria-checked') === 'true')

    expect(chosen).toHaveLength(1)
    expect(chosen[0].textContent).toBe('Cheque')
  })

  it('is one stop in the tab order rather than four', () => {
    // What converting bought, and it was measured on the hand-written version before it went: four buttons were four stops, so a keyboard crossing the day sheet passed through four controls where a group is one.

    // The stop is the group itself and not the chosen box. Radix puts the tab stop on the root and hands focus inward to whichever choice is current, which is why asking the boxes finds none -- and a row where nothing at all is tabbable would look exactly the same from that end, so both are asked.
    render(<ARowOfChoices />)

    const group = screen.getByRole('radiogroup', { name: 'How paid' })
    const stops = screen.getAllByRole('radio').filter((one) => one.getAttribute('tabindex') !== '-1')

    expect(group.getAttribute('tabindex'), 'the row cannot be reached by a keyboard at all').toBe('0')
    expect(stops, 'a row of choices is one stop, not four').toHaveLength(0)
  })

  it('moves between the choices on an arrow key, which the hand-written rows ignored', async () => {
    const user = userEvent.setup()
    render(<ARowOfChoices />)

    const [first, second] = screen.getAllByRole('radio')
    first.focus()
    await user.keyboard('{ArrowRight}')

    expect(document.activeElement).toBe(second)
  })

  it('chooses on the space bar rather than on arriving, which is the one way it is not a radio group', () => {
    // Written down rather than left as a surprise. In a real radio group, moving to a choice picks it; Radix's segmented control moves focus and waits to be pressed. Whoever changes this control should know that is the difference, and this is where it is recorded.
    render(<ARowOfChoices />)

    const [, second] = screen.getAllByRole('radio')
    second.focus()

    expect(second.getAttribute('aria-checked'), 'arriving on a choice does not pick it').toBe('false')
  })

  it('will not let an answered question be un-answered', async () => {
    // Radix un-chooses when the chosen one is pressed again, and hands back an empty string. There is no such thing here: no payment was made by no method. The trap under it is that `Number('')` is 0, so an empty answer read straight would quietly become the first choice.
    const user = userEvent.setup()
    render(<ARowOfChoices />)

    const [first] = screen.getAllByRole('radio')
    await user.click(first)

    expect(first.getAttribute('aria-checked')).toBe('true')
  })

  it('has nothing chosen when nothing has been answered yet', () => {
    // The other end of the same lookup. A choice this row does not hold is `findIndex` returning -1, which has to render as no answer rather than as one.
    render(<ARowOfChoices start="" />)

    const chosen = screen.getAllByRole('radio').filter((one) => one.getAttribute('aria-checked') === 'true')

    expect(chosen).toHaveLength(0)
  })

  it('can be named without the words being written on the screen', () => {
    // For the two rows whose choices are whole sentences that ask the question themselves. The name is still there to be heard -- what changes is that it is not drawn over `Part of what the house cost`.
    render(
      <Choices
        label="Whether Scaffolding is part of what the house cost"
        onlySpoken
        chosen
        choices={[
          { is: true, said: 'Part of what the house cost' },
          { is: false, said: 'Land, taxes and commission' },
        ]}
        onChoose={() => {}}
      />
    )

    const named = screen.getByRole('radiogroup', { name: 'Whether Scaffolding is part of what the house cost' })
    const label = named.previousElementSibling

    expect(label?.textContent).toBe('Whether Scaffolding is part of what the house cost')
    expect(label?.className, 'the words are still drawn, over the choices that ask the question themselves').toContain(
      'sr-only'
    )
  })
})

// The seventh row, which the rule that found the other six could not see. `HowItLooks` drew shadcn's `ToggleGroup` directly, and the rule refuses `role="radio"` written by hand -- Radix writes the role there, so nothing had anything to say about it. It stayed 36px, eight under the floor a thumb needs, on the screen somebody opens because the screen is already hard to read outside.

// So the rule is about the control rather than about the role: whatever is drawn on shadcn's segmented control is a row of choices, and there is one place that draws one.
describe('shadcn’s segmented control', () => {
  /** The one file whose job is to draw one, and the file that sets the 44px floor every choice in this app is measured against. */
  const WHERE_IT_IS_DRAWN = 'components/form/Choices.tsx'

  it('is drawn in one place, so the floor is set in one place', () => {
    const drawn = everyScreen()
      .filter(({ path }) => path.startsWith('components/') && !path.startsWith('components/ui/'))
      .filter(({ path }) => path !== WHERE_IT_IS_DRAWN)
      .filter(({ source }) => /<ToggleGroup\b/.test(source))
      .map(({ path }) => `${path}: draws a row of choices itself instead of asking for one`)

    expect(drawn).toEqual([])
  })

  it('is really drawn where this says it is', () => {
    // The other end. A rule naming one place passes perfectly when that place draws nothing, and then the floor it is trusted for is set nowhere.
    const draws = everyScreen().find(({ path }) => path === WHERE_IT_IS_DRAWN)

    expect(draws?.source, 'nothing draws a row of choices any more').toMatch(/<ToggleGroup\b/)
    expect(draws?.source, 'the row of choices no longer sets the floor a thumb needs').toContain('min-h-11')
  })
})
