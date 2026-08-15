import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Choosing from a list is two acts now rather than one. A `<select>` took a value; a combobox is opened and then chosen from, which is also what somebody does with their thumb.

// Written once because a dozen tests across six screens do it, and because six copies of it drift the day the control changes again.
export async function pick(user: ReturnType<typeof userEvent.setup>, label: string, named: string): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: named }))
}

/** A name nobody has, which the control offers to use rather than sending anybody to a second box. */
export async function useTheName(user: ReturnType<typeof userEvent.setup>, label: string, name: string): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.type(screen.getByRole('combobox', { name: label }), name)
  await user.click(await screen.findByRole('button', { name: `Use “${name}”` }))
}
