import { describe, expect, it } from 'vitest'

import { coveredArea, siteInput, siteName } from './site'

describe('the covered area of a house', () => {
  it.each([
    ['5,500', 5500],
    ['100', 100],
    ['20000', 20000],
    [7250, 7250],
  ])('takes %o, the way it is written', (typed, sqft) => {
    expect(coveredArea.parse(typed)).toBe(sqft)
  })

  it.each([
    ['99', 'a hand slipping off the keypad'],
    ['20001', 'larger than any house in ten years of workbooks'],
    ['550000', 'a comma that should have been a decimal point'],
    ['0', 'nothing at all'],
    ['-500', 'a minus that means nothing here'],
    ['not a number', 'words'],
  ])('refuses %o, which is %s', (typed) => {
    const checked = coveredArea.safeParse(typed)

    expect(checked.success).toBe(false)
    expect(checked.error?.issues[0]?.message).toBe('Put in the covered area in square feet.')
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
