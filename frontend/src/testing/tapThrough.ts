import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// A screen that keeps itself folded up until somebody asks. `Change the contract` shows three ways out and nothing else; the measurement box, the revision and the are-you-sure are each behind a tap, and a destructive control is two taps in.

// Every sweep in this repository looked at screens at rest, which is a state half of them are never in while anybody uses them. The camera had that blindness and so did the two jsdom sweeps that render every screen, so the screens they were reading were not the screens somebody stands in front of.

// Written once because both sweeps need it and the camera needs the same list: what a screen shows after the taps is what it shows, and a rule re-applied by hand in three places is a rule the third one forgets.

/** Tap through what a screen keeps folded, in the order somebody would. */
export async function tapThrough(tapFirst: Array<string> | undefined, inside: HTMLElement): Promise<void> {
  if (tapFirst === undefined || tapFirst.length === 0) return

  const user = userEvent.setup()

  for (const named of tapFirst) {
    // Awaited rather than found, because each tap draws what the next one is on: the are-you-sure does not exist until the way out has been tapped.

    // The first of them, and matched on part of the name rather than all of it, because the camera taps the same list through Playwright and that is what Playwright's `name` does. A way out on a row carries the row in its label -- `Take out ₨26,50,000 paid to …` -- so an exact match here would find nothing while the camera found it, and the two instruments would be reading different screens.
    const [first] = await within(inside).findAllByRole('button', { name: partOfAName(named) })

    await user.click(first)
  }
}

/** What Playwright's `name` means: a case-insensitive part of the accessible name, said in the one regular expression testing-library takes. */
function partOfAName(named: string): RegExp {
  return new RegExp(named.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), 'i')
}
