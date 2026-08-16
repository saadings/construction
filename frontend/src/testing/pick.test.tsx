// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick } from './pick'

afterEach(cleanup)

// The helper's patience, which is the whole of what this file is about. Nothing here tests a combobox: the control is hand-made and deliberately dull, because the subject is how long `pick` will wait for a list, not what draws it.

/** How late the list arrives. Above testing-library's own 1000ms and well below what `pick` now waits, so this passes for the reason it claims to and not by luck. */
const LATE = 1_500

function AListThatTakesItsTime({ onPick }: { onPick: (named: string) => void }) {
  const [open, setOpen] = useState(false)
  const [arrived, setArrived] = useState(false)

  useEffect(() => {
    if (!open) return

    const coming = setTimeout(() => {
      setArrived(true)
    }, LATE)

    return () => {
      clearTimeout(coming)
    }
  }, [open])

  return (
    <div>
      <button
        type="button"
        role="combobox"
        aria-label="What for"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
        }}
      >
        Pick one
      </button>

      {arrived ? (
        <ul role="listbox">
          <li
            role="option"
            aria-selected={false}
            onClick={() => {
              onPick('Cement')
            }}
          >
            Cement
          </li>
        </ul>
      ) : null}
    </div>
  )
}

describe('choosing from a list', () => {
  it('waits for a list that takes longer than the second nobody chose', async () => {
    // Three tests in `DaySheet.test.tsx` died here, on a machine with two forgotten vite servers, another session's convex and vite, and seven browsers on it. The control had opened; the list had not come within 1000ms, which is testing-library's default and nobody's decision.
    const user = userEvent.setup()
    const chose = vi.fn()

    render(<AListThatTakesItsTime onPick={chose} />)

    await pick(user, 'What for', 'Cement')

    expect(chose).toHaveBeenCalledWith('Cement')
  })

  it('is waiting rather than finding it immediately, or this proves nothing', async () => {
    // The control. If the list were there from the start, the test above would pass under any timeout at all, including the one it exists to rule out.
    render(<AListThatTakesItsTime onPick={vi.fn()} />)

    expect(screen.queryByRole('option', { name: 'Cement' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'What for' }).getAttribute('aria-expanded')).toBe('false')
  })
})
