// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CHOSEN_DARK, FAR_ENOUGH, LIGHT, asAColour, asAMixedColour, toldApart } from '../../testing/colour'
import { HOW_IT_IS_DRAWN } from './MoneyByMonth'

// What came in, in two series, on the screen he opens first. `Own funds` was drawn in brass -- the colour this app uses for money going out -- so half the bars under a heading saying `Invested` were painted as money leaving.

// Nothing could see it. The palette was measured for readability and every colour passed; a colour can be perfectly readable and still say the wrong thing.

/** What a chart series really comes to on the page, following aliases and mixes to a colour somebody sees. */
function drawnIn(series: keyof typeof HOW_IT_IS_DRAWN, palette: Record<string, string>): string {
  const said = asAMixedColour(HOW_IT_IS_DRAWN[series].color, palette)

  if (said === null) {
    throw new Error(`${series} is drawn in ${HOW_IT_IS_DRAWN[series].color}, which is not a colour this palette has.`)
  }

  return said
}

describe('a chart about money coming in', () => {
  it('paints neither series in the colour of money going out', () => {
    for (const palette of [LIGHT, CHOSEN_DARK]) {
      const brass = asAColour('--brass', palette) ?? ''

      for (const series of ['broughtIn', 'ownMoney'] as const) {
        expect(
          toldApart(drawnIn(series, palette), brass),
          `${series} is ${toldApart(drawnIn(series, palette), brass).toFixed(1)} from brass, which means money going out`
        ).toBeGreaterThan(FAR_ENOUGH)
      }
    }
  })

  it('tells its own two series apart, which is what a legend is read against', () => {
    // The other end, and the reason this is not solved by painting both of them green: two bars a person compares side by side have to be two bars.
    for (const palette of [LIGHT, CHOSEN_DARK]) {
      expect(toldApart(drawnIn('broughtIn', palette), drawnIn('ownMoney', palette))).toBeGreaterThan(FAR_ENOUGH)
    }
  })

  it('says the difference between them in strength rather than in a third meaning', () => {
    // Both are money coming in, and the difference is where it came from. This app gives a colour to a direction, so a second colour here would be a third meaning for a distinction that is not one.
    expect(HOW_IT_IS_DRAWN.broughtIn.color).toBe('var(--green)')
    expect(HOW_IT_IS_DRAWN.ownMoney.color).toContain('var(--green)')
  })

  it('is reading colours rather than strings that resolve to nothing', () => {
    // The floor. A resolver that returned the same non-answer for everything would report every pair as far enough apart, and a legend swatch of nothing looks like a legend swatch.

    // Held to the palette rather than to a hex: this pinned `#4a6b52` and the redesign moved green, which is not this test's subject.
    expect(drawnIn('broughtIn', LIGHT)).toBe(asAColour('--green', LIGHT))
    expect(drawnIn('ownMoney', LIGHT)).toMatch(/^#[\da-f]{6}$/i)
    expect(drawnIn('ownMoney', LIGHT)).not.toBe(drawnIn('broughtIn', LIGHT))
    expect(asAMixedColour('color-mix(in srgb, var(--green) 100%, var(--ground))', LIGHT)).toBe(
      asAColour('--green', LIGHT)
    )
  })
})
