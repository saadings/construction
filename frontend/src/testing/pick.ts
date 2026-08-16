import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Choosing from a list is two acts now rather than one. A `<select>` took a value; a combobox is opened and then chosen from, which is also what somebody does with their thumb.

// Written once because a dozen tests across six screens do it, and because six copies of it drift the day the control changes again.

// How long to wait for the list to arrive after the control is opened. Chosen rather than inherited: `findBy*` carries testing-library's own 1000ms, which is not a considered value, it is a default that came with the import -- and this repository has 34 `pick` calls across 7 files, three of them in every `fillOne`.

// A timeout is only ever paid when the wait fails. On an idle machine the options arrive in tens of milliseconds, so a generous figure costs a passing suite nothing at all, and costs a genuinely stuck test a few seconds of extra patience. The error is cheap one way and expensive the other, and the value follows from that rather than from what looks tidy.

// Which is the whole of its justification: this figure is not tuned to a measurement either, and nobody should read an explicit `timeout:` as evidence that somebody timed something. It is large because being large is nearly free here, and because a machine that routinely runs several node processes at once should not have a race decided for it by whatever a library shipped.

// It was expensive: three tests in `DaySheet.test.tsx` timed out here on a machine running two forgotten vite servers, another session's convex and vite, and seven browsers. The control had opened -- `aria-expanded="true"` -- and the list simply had not come within the second nobody chose.
const LONG_ENOUGH_TO_BE_ABOUT_THE_LIST = 5_000

export async function pick(user: ReturnType<typeof userEvent.setup>, label: string, named: string): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: named }, { timeout: LONG_ENOUGH_TO_BE_ABOUT_THE_LIST }))
}

/** A name nobody has, which the control offers to use rather than sending anybody to a second box. */
export async function useTheName(user: ReturnType<typeof userEvent.setup>, label: string, name: string): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.type(screen.getByRole('combobox', { name: label }), name)
  await user.click(
    await screen.findByRole('button', { name: `Use “${name}”` }, { timeout: LONG_ENOUGH_TO_BE_ABOUT_THE_LIST })
  )
}
