// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { across } from './Bar'

// How far along a bar is drawn. A proportion is a number and there is no class for one, so this is the only part of a bar that is worked out rather than written.
describe('how far along a bar is drawn', () => {
  it('is the share of the largest, so the second bar is readable when the first is most of the money', () => {
    // Against the largest and not against a total: five trades where one is 80% of the spend leaves the other four at four percentage points between them, which is four bars nobody can compare.
    expect(across(50, 100)).toBe(50)
    expect(across(100, 100)).toBe(100)
    expect(across(1_000_00, 8_000_00)).toBe(13)
  })

  it('gives a real amount a visible mark rather than a sliver of nothing', () => {
    // A trade that is a thousandth of the spend is still money somebody paid, and a bar rounded to zero says it never happened.
    expect(across(1, 100_000)).toBe(2)
  })

  it('draws nothing at all for nothing at all, which is the one case that must not have a floor', () => {
    // The other end of the same rule. A month where no partner money came in is a real month, and a 2% mark on it says some did.
    expect(across(0, 100)).toBe(0)
  })

  it('answers for a chart where nothing has happened yet, rather than dividing by it', () => {
    // Every bar zero makes the largest zero. `paisa / 0` is `Infinity`, and `Math.max(2, Math.round(Infinity))` is a width of `Infinity%` -- which a browser drops, leaving a bar that is the full track. Nothing on that screen would say it was wrong.
    expect(across(0, 0)).toBe(0)
    expect(across(5, 0)).toBe(0)
  })

  it('does not run backwards on a figure that has gone the other way', () => {
    // Nothing sends a negative here today. A width cannot be negative, so if anything ever does it draws nothing rather than a bar the browser silently ignores.
    expect(across(-500, 1_000)).toBe(0)
  })
})
