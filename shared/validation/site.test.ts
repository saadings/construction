import { describe, expect, it } from 'vitest'

import { areaWhileTyping, coveredArea, siteInput, siteName } from './site'

describe('the covered area of a house', () => {
  it.each([
    ['5,500', 5500],
    ['100', 100],
    ['20000', 20000],
    [7250, 7250],
  ])('takes %o, the way it is written', (typed, sqft) => {
    expect(coveredArea.parse(typed)).toBe(sqft)
  })

  // What is wrong decides what is said. One sentence for all of these told whoever typed 50 that he had not put in square feet, when he had.
  it.each([
    ['99', 'a hand slipping off the keypad', 'too small'],
    ['0', 'nothing at all', 'too small'],
    ['-500', 'a minus that means nothing here', 'too small'],
    ['20001', 'larger than any house in ten years of workbooks', 'too large'],
    ['550000', 'a comma that should have been a decimal point', 'too large'],
    ['not a number', 'words', 'not figures'],
  ])('refuses %o, which is %s, and says it is %s', (typed, _because, said) => {
    const checked = coveredArea.safeParse(typed)
    const message = checked.error?.issues[0]?.message ?? 'nothing was refused'

    expect(checked.success).toBe(false)
    expect({
      'too small': 'That is too small for a house. The least this takes is 100 square feet.',
      'too large':
        'That is larger than any house here. The biggest in ten years is a little over 10,000, and the most this takes is 20,000 square feet.',
      'not figures': 'Put in the covered area in figures, like 4,975.',
    }).toHaveProperty([said], message)
  })

  it('never answers two different mistakes with one sentence', () => {
    const refusals = ['50', '99999', 'Alasdfas', ''].map(
      (typed) => coveredArea.safeParse(typed).error?.issues[0]?.message
    )

    expect(new Set(refusals).size).toBe(3)
  })

  // `Alasdfas` was typed into this field on a desktop and screenshotted. A keyboard hint is a hint on a phone and nothing at all anywhere else.
  it.each([
    ['Alasdfas', ''],
    ['4,975', '4,975'],
    ['4a9b7c5', '4975'],
    ['5 500 sqft', '5500'],
    ['-500', '500'],
  ])('takes %o as it is typed and holds %o', (typed, held) => {
    expect(areaWhileTyping(typed)).toBe(held)
  })

  it('is optional on a site, because it is often not settled when the plot is bought', () => {
    const site = siteInput.parse({ name: '1-A, Phase 0', builtForAClient: false, stage: 'planning' })

    expect(site.coveredAreaSqft).toBeUndefined()
  })
})

describe('the name of a house', () => {
  it('is stored the way it is said, however it was typed', () => {
    expect(siteName.parse('  1-A,   Phase 0 ')).toBe('1-A, Phase 0')
  })

  it('says what to write when it is too short to be an address', () => {
    const checked = siteName.safeParse('R')

    expect(checked.success).toBe(false)
    expect(checked.error?.issues[0]?.message).toContain('the way you say it')
  })
})
