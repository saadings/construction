import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// The stylesheet is read rather than rendered, because what this is about cannot be seen in one mode: a token defined in only one of the two dark blocks looks perfect until somebody uses the switch.

// From the repository root, because under jsdom `import.meta.url` is an http address and not a path to anything.
const STYLES = readFileSync('frontend/src/styles.css', 'utf8')

// Anchored to where a rule starts, because these selectors also appear inside `@custom-variant`, and reading that block back gives an empty set of tokens that agrees with every other empty set.
function tokensIn(selector: string): Record<string, string> {
  const rule = new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm')
  const found = rule.exec(STYLES)
  expect(found, `${selector} is not a rule in the stylesheet`).not.toBeNull()

  const start = found?.index ?? 0
  const block = STYLES.slice(STYLES.indexOf('{', start) + 1, STYLES.indexOf('}', start))
  const declared: Record<string, string> = {}

  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declared[name] = value.trim()
  }

  return declared
}

const LIGHT = tokensIn(':root')
const FOLLOWING_THE_PHONE = tokensIn(":root:not([data-theme='light'])")
const CHOSEN_DARK = tokensIn(":root[data-theme='dark']")

describe('the two ways a page goes dark', () => {
  it('says the same thing in both places', () => {
    // One is for a phone in dark mode, the other for somebody who chose dark. They are two blocks because CSS cannot group them, and drift between them is invisible until the switch is used.
    expect(CHOSEN_DARK).toEqual(FOLLOWING_THE_PHONE)
  })

  it('changes something, rather than being two empty blocks agreeing', () => {
    // The control. Without it the check above passes when both are empty, which is the state where dark mode does not exist.
    expect(Object.keys(CHOSEN_DARK).length).toBeGreaterThan(8)
    expect(CHOSEN_DARK['--ground']).not.toBe(LIGHT['--ground'])
  })

  it('gives no colour its only home in the dark', () => {
    // A token first defined inside a media query is undefined in the light, which is how a page renders one mode's text on the other mode's ground.
    const onlyInTheDark = Object.keys(CHOSEN_DARK).filter((token) => !(token in LIGHT))

    expect(onlyInTheDark).toEqual([])
  })
})

describe('the palette', () => {
  it('carries meaning in two colours and no more', () => {
    // Brass is money going out, green is money owed to him. A third would mean a figure could be coloured for a reason nobody can name.
    expect(LIGHT['--brass']).toBe('#8a5a1e')
    expect(LIGHT['--green']).toBe('#4a6b52')
    expect(CHOSEN_DARK['--brass']).toBe('#d19a4a')
    expect(CHOSEN_DARK['--green']).toBe('#7da888')
  })

  it('keeps the ground warm after dark', () => {
    // Not taste: a blue-black ground under brass makes the brass look dirty, and brass here is the colour of money.
    const [red, , blue] = [1, 3, 5].map((at) => parseInt(CHOSEN_DARK['--ground'].slice(at, at + 2), 16))

    expect(red).toBeGreaterThan(blue)
  })

  it('paints the page itself, rather than borrowing whatever is behind it', () => {
    expect(STYLES).toContain('background-color: var(--background)')
  })
})
