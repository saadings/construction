// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CHOSEN_DARK, FAR_ENOUGH, FOLLOWING_THE_PHONE, LIGHT, asAColour, contrast, toldApart } from './testing/colour'
import { everyScreen } from './testing/screens'

// Nauman asked why a section had no contrast. It had none because the text was painted in a background colour -- `--color-muted` is the alternating row tint, so `text-muted` was the same colour as the page at 1.04:1, in both modes.

// Nothing here could see it. Every other instrument reads what the source says; this one does the arithmetic a renderer would do, which is the only way text that is present and unreadable ever gets found without somebody opening the page.

/** What the standard asks of body text. Large text is allowed 3, and none of these labels are large: the uppercase ones are 12px. */
const READABLE = 4.5

// Every colour words are set in, and every surface words sit on. Paired rather than measured against one assumed background, because `--faint` on the panel is a different sum from `--faint` on the page -- and it was the panel that failed while the page passed.
const WORDS = ['--ink', '--muted-ink', '--faint', '--brass', '--green', '--refusal']
const SURFACES = ['--ground', '--panel', '--row-alt', '--hairline']

function whatCannotBeRead(palette: Record<string, string>): Array<string> {
  const failing: Array<string> = []

  for (const word of WORDS) {
    const ink = asAColour(word, palette)
    if (ink === null) continue

    for (const surface of SURFACES) {
      const behind = asAColour(surface, palette)
      if (behind === null) continue

      const measured = contrast(ink, behind)
      if (measured < READABLE) {
        failing.push(`${word} on ${surface} is ${measured.toFixed(2)}:1`)
      }
    }
  }

  return failing
}

describe('words a person can actually read', () => {
  it('is every colour words are set in, on every surface they sit on, in light', () => {
    // He reads this on a phone, outdoors, on a site. Light is the mode he is in and it was the mode that was wrong: the two quiet greys were 3.20 and 2.43 against the hairline, which is the darkest surface either of them sits on.
    expect(whatCannotBeRead(LIGHT)).toEqual([])
  })

  it('and in dark, which was not fine either', () => {
    // Reported as fine by both of us and measured by neither: `--faint` was 3.59 against the hairline here. A number quoted from memory is not a measurement -- I quoted 4.99 for it from a hex that is not in this file.
    expect(whatCannotBeRead(FOLLOWING_THE_PHONE)).toEqual([])
    expect(whatCannotBeRead(CHOSEN_DARK)).toEqual([])
  })

  it('is reading a palette rather than an empty one', () => {
    // The floor, anchored on a pairing that exists today. A reader that stopped parsing the stylesheet would find nothing wrong with it, which is exactly what a clean palette looks like.
    expect(asAColour('--ground', LIGHT)).toBe('#faf7f0')
    // Followed through its alias: `--background` is `var(--ground)`, and a palette that aliases is still a palette.
    expect(asAColour('--background', LIGHT)).toBe('#faf7f0')
    expect(asAColour('--muted-foreground', LIGHT)).toBe(asAColour('--muted-ink', LIGHT))
  })

  it('measures the way the standard measures, not the way a colour looks', () => {
    // The controls. Black on white is the top of the scale and a colour on itself is the bottom, so an arithmetic slip cannot pass unnoticed.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#faf7f0', '#faf7f0')).toBeCloseTo(1, 2)

    // And the one he found, verbatim: the row tint set as text on the page.
    expect(contrast('#f6f2e9', '#faf7f0')).toBeCloseTo(1.04, 2)
  })

  it('would notice the greys going back to what they were', () => {
    // Planted in the palette rather than in the sum, because the palette is the thing being described.
    const asShipped = { ...LIGHT, '--muted-ink': '#8a8274', '--faint': '#a09786' }

    // The surfaces named as the sweep names them. Written from memory the first time, against the panel, which is not the surface either of those figures came from -- the plant was right and the expectation was wrong.
    expect(whatCannotBeRead(asShipped)).toContain('--muted-ink on --hairline is 3.20:1')
    expect(whatCannotBeRead(asShipped)).toContain('--faint on --hairline is 2.43:1')
    expect(whatCannotBeRead(asShipped)).toHaveLength(8)
  })
})

// Every colour in this palette that means something, and what it means. A colour carrying a meaning has to be told apart from every other one carrying a different meaning, or the meaning is not carried at all.
const MEANS_SOMETHING = {
  '--brass': 'money going out',
  '--green': 'money owed to him',
  '--refusal': 'this removes something',
}

function whatCannotBeToldApart(palette: Record<string, string>): Array<string> {
  const named = Object.keys(MEANS_SOMETHING)

  return named.flatMap((one, at) =>
    named.slice(at + 1).flatMap((other) => {
      const first = asAColour(one, palette)
      const second = asAColour(other, palette)
      if (first === null || second === null) return []

      const apart = toldApart(first, second)

      return apart < FAR_ENOUGH ? [`${one} and ${other} are ${apart.toFixed(1)} apart`] : []
    })
  )
}

describe('two colours that mean different things', () => {
  it('are far enough apart to be told apart, in light', () => {
    expect(whatCannotBeToldApart(LIGHT)).toEqual([])
  })

  it('and in dark, where the same three are lighter and could close up', () => {
    expect(whatCannotBeToldApart(FOLLOWING_THE_PHONE)).toEqual([])
    expect(whatCannotBeToldApart(CHOSEN_DARK)).toEqual([])
  })

  it('would notice the refusal that shipped, which no contrast sum could', () => {
    // Planted in the palette rather than in the sum. Both directions of the point in one test: the ratio passes this and the distance does not.
    const asShipped = { ...LIGHT, '--refusal': '#8f3521' }

    expect(whatCannotBeToldApart(asShipped)).toEqual(['--brass and --refusal are 17.9 apart'])
    expect(whatCannotBeRead(asShipped)).toEqual([])
  })

  it('measures distance the way the eye does, not the way a ratio does', () => {
    // The controls, at both ends of the scale.
    expect(toldApart('#000000', '#ffffff')).toBeCloseTo(100, 0)
    expect(toldApart('#8a5a1e', '#8a5a1e')).toBeCloseTo(0, 5)

    // And the pair this app has always told apart, which a contrast ratio calls identical. Both numbers, so neither can be read as the other.
    expect(toldApart('#8a5a1e', '#4a6b52')).toBeGreaterThan(FAR_ENOUGH)
    expect(contrast('#8a5a1e', '#4a6b52')).toBeLessThan(1.1)
  })

  it('is asked of colours that are really in the stylesheet', () => {
    // The floor. A palette read as an empty object has nothing in it that means anything, and reports every pair as far enough apart.
    for (const name of Object.keys(MEANS_SOMETHING)) {
      expect(asAColour(name, LIGHT), `${name} means something and is not in the palette`).toMatch(/^#[\da-f]{6}$/i)
      expect(asAColour(name, CHOSEN_DARK), `${name} means something and has no dark value`).toMatch(/^#[\da-f]{6}$/i)
    }
  })
})

describe('what a screen sets words in', () => {
  // The other half, and the cause: `--muted` is the row tint and `--muted-foreground` is the readable grey, so `text-muted` painted words in a background. It was used 22 times across 11 files.

  // Asked as arithmetic rather than as naming. "It has a `-foreground` partner" would call `text-primary` and `text-destructive` backgrounds too, and both are real ink -- brass is money going out and the refusal red is a refusal. What is actually wrong is a colour nobody could read on the page.
  const screens = everyScreen()

  /** Every token a screen could write as `text-x`, with what it comes to and whether it can be read on the page. */
  function tooQuietToRead(): Array<string> {
    const ground = asAColour('--ground', LIGHT)
    const unreadable = Object.keys(LIGHT)
      .filter((name) => {
        const colour = asAColour(name, LIGHT)
        return colour !== null && ground !== null && contrast(colour, ground) < READABLE
      })
      .map((name) => name.replace('--', ''))

    // Judged by the surface each usage declares, not by the page alone. `text-primary-foreground` on `bg-primary` is ink for a coloured button and would fail against the page it never sits on; a class list that paints its own background has answered the question itself.
    return screens.flatMap(({ path, source }) =>
      [...source.matchAll(/className="([^"]*)"/g)].flatMap((classes) =>
        unreadable
          .filter((word) => new RegExp(`text-${word}(?![\\w-])`).test(classes[1]) && !/\bbg-/.test(classes[1]))
          .map((word) => `${path}: text-${word} cannot be read on the surface behind it`)
      )
    )
  }

  it('is never a colour nobody could read', () => {
    expect(tooQuietToRead()).toEqual([])
  })

  it('is asked of the class lists this app really writes', () => {
    // The floor. A reader that stopped finding class lists would report the same clean sweep as an app where every colour is readable.
    const lists = screens.flatMap(({ source }) => [...source.matchAll(/className="([^"]*)"/g)])

    expect(lists.length).toBeGreaterThan(100)
    expect(screens.map(({ path }) => path)).toContain('components/moneyIn/WhatHasComeIn.tsx')
  })

  it('leaves the two colours that carry meaning alone', () => {
    // Brass is money going out and the refusal red is a refusal. Both have a `-foreground` partner because a button is painted in them, and both are read as words all over the app.
    const ground = asAColour('--ground', LIGHT)

    expect(contrast(asAColour('--brass', LIGHT) ?? '#000000', ground ?? '#ffffff')).toBeGreaterThan(READABLE)
    expect(contrast(asAColour('--refusal', LIGHT) ?? '#000000', ground ?? '#ffffff')).toBeGreaterThan(READABLE)
  })

  it('would notice the one that was shipped', () => {
    // `text-muted` reads as "the muted one" and is the row tint at 1.04:1. It is the whole of what he saw.
    const rowTint = asAColour('--muted', LIGHT) ?? '#000000'
    const ground = asAColour('--ground', LIGHT) ?? '#ffffff'

    expect(contrast(rowTint, ground)).toBeLessThan(READABLE)
    expect(/text-muted(?![\w-])/.test('<p className="text-muted text-sm">')).toBe(true)
    // And the readable one is not caught by it, which is the trap that made the count wrong: `\b` sits between `muted` and `-foreground`.
    expect(/text-muted(?![\w-])/.test('<p className="text-muted-foreground text-sm">')).toBe(false)
  })
})
