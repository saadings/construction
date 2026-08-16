import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The arithmetic a renderer does, so a test can ask what a person would actually see. Every other instrument in this repository reads what the source says; this one reads what the source comes to.

// Kept out of the test that first needed it once a second one did. A chart's two series have to be told apart from each other by the same sum the palette is held to, and two copies of CIEDE2000 would be two answers.

const STYLES = readFileSync(join(dirname(new URL(import.meta.url).pathname), '..', 'styles.css'), 'utf8')

/** Every custom property a rule declares, read off the stylesheet rather than off a copy of it kept in a test. */
export function tokensIn(selector: string): Record<string, string> {
  const rule = new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}\\s*\\{`, 'm')
  const found = rule.exec(STYLES)

  if (found === null) {
    throw new Error(`${selector} is not a rule in the stylesheet, so this is reading nothing.`)
  }

  const block = STYLES.slice(STYLES.indexOf('{', found.index) + 1, STYLES.indexOf('}', found.index))
  const declared: Record<string, string> = {}

  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declared[name] = value.trim()
  }

  return declared
}

/** The palette as the page has it: light, light overridden by a phone in dark, and light overridden by somebody choosing dark. */
export const LIGHT = tokensIn(':root')
export const FOLLOWING_THE_PHONE = { ...LIGHT, ...tokensIn(":root:not([data-theme='light'])") }
export const CHOSEN_DARK = { ...LIGHT, ...tokensIn(":root[data-theme='dark']") }

/** A token said as a colour, following `var(--x)` until it reaches one. A palette that aliases is still a palette. */
export function asAColour(name: string, palette: Record<string, string>, depth = 0): string | null {
  // An alias that points at itself, or at something not in this palette, stops here rather than going round forever.
  if (!(name in palette) || depth > 5) {
    return null
  }

  const said = palette[name]

  const alias = /^var\((--[\w-]+)\)$/.exec(said)

  return alias === null ? (/^#[\da-f]{6}$/i.test(said) ? said : null) : asAColour(alias[1], palette, depth + 1)
}

/** What a `color-mix(in srgb, var(--a) N%, var(--b))` comes to, which is a real colour a person sees and not a string. */
export function asAMixedColour(said: string, palette: Record<string, string>): string | null {
  const mix = /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*(\d+)%,\s*var\((--[\w-]+)\)\)$/.exec(said)

  if (mix === null) {
    const plain = /^var\((--[\w-]+)\)$/.exec(said)

    return plain === null ? (/^#[\da-f]{6}$/i.test(said) ? said : null) : asAColour(plain[1], palette)
  }

  const front = asAColour(mix[1], palette)
  const behind = asAColour(mix[3], palette)
  if (front === null || behind === null) return null

  const strength = Number(mix[2]) / 100

  return `#${[1, 3, 5]
    .map((at) =>
      Math.round(
        parseInt(front.slice(at, at + 2), 16) * strength + parseInt(behind.slice(at, at + 2), 16) * (1 - strength)
      )
    )
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

/** How light a colour is, the way the standard defines it rather than the way it looks. */
export function howLight(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const [red, green, blue] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrast(one: string, other: string): number {
  const [lighter, darker] = [howLight(one), howLight(other)].sort((a, b) => b - a)

  return (lighter + 0.05) / (darker + 0.05)
}

// Whether two colours can be told apart is a different question from whether either can be read, and the sum above cannot answer it. Brass and green are 1.01:1 -- as close as a contrast ratio goes -- and nobody has ever confused money going out with money owed, because they are 108 degrees apart in hue.

// Asked of it anyway, the ratio says the opposite of the truth in both directions: it passes a destructive red sitting beside money at 1.32 and fails the pair this app has always told apart.

/** A colour in CIELAB, which is the space distances are measured in rather than the one screens are lit in. */
export function inLab(hex: string): [number, number, number] {
  const [red, green, blue] = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))

  const x = (0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047
  const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const z = (0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** How far apart two colours look, by CIEDE2000: 0 is the same colour and 100 is black against white. */
export function toldApart(one: string, other: string): number {
  const [l1, a1, b1] = inLab(one)
  const [l2, a2, b2] = inLab(other)
  const rad = Math.PI / 180
  const deg = 180 / Math.PI

  const chromas = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const g = 0.5 * (1 - Math.sqrt(Math.pow(chromas, 7) / (Math.pow(chromas, 7) + Math.pow(25, 7))))
  const [ap1, ap2] = [(1 + g) * a1, (1 + g) * a2]
  const [cp1, cp2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)]

  const angle = (x: number, y: number) => {
    if (x === 0 && y === 0) return 0
    const found = Math.atan2(y, x) * deg

    return found < 0 ? found + 360 : found
  }

  const [h1, h2] = [angle(ap1, b1), angle(ap2, b2)]

  const dL = l2 - l1
  const dC = cp2 - cp1

  let dh = cp1 * cp2 === 0 ? 0 : h2 - h1
  if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360

  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh * rad) / 2)

  const lBar = (l1 + l2) / 2
  const cBar = (cp1 + cp2) / 2

  let hBar = h1 + h2
  if (cp1 * cp2 !== 0) {
    if (Math.abs(h1 - h2) > 180) hBar += h1 + h2 < 360 ? 360 : -360
    hBar /= 2
  }

  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * rad) +
    0.24 * Math.cos(2 * hBar * rad) +
    0.32 * Math.cos((3 * hBar + 6) * rad) -
    0.2 * Math.cos((4 * hBar - 63) * rad)

  const sL = 1 + (0.015 * Math.pow(lBar - 50, 2)) / Math.sqrt(20 + Math.pow(lBar - 50, 2))
  const sC = 1 + 0.045 * cBar
  const sH = 1 + 0.015 * cBar * t

  const turned =
    -2 *
    Math.sqrt(Math.pow(cBar, 7) / (Math.pow(cBar, 7) + Math.pow(25, 7))) *
    Math.sin(60 * Math.exp(-Math.pow((hBar - 275) / 25, 2)) * rad)

  return Math.sqrt(Math.pow(dL / sL, 2) + Math.pow(dC / sC, 2) + Math.pow(dH / sH, 2) + turned * (dC / sC) * (dH / sH))
}

// The floor, measured rather than picked: brass and green are 28.9 apart and this app has told them apart since the first screen. So the pair it already works with is what everything else is held to, less a little room for a colour somebody adjusts.

/** How far apart two colours have to be before this app will let them carry different meanings. */
export const FAR_ENOUGH = 25
