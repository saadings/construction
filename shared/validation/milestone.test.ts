import { describe, expect, it } from 'vitest'

import { milestoneAmountPaisa, milestoneInput, percentAgreedSoFar } from './milestone'

describe('what a stage comes to', () => {
  it('is its share of the contract, worked out rather than typed', () => {
    expect(milestoneAmountPaisa(1_200_000_00, 25)).toBe(300_000_00)
  })

  it('is whole paisa even when the share does not divide', () => {
    // Rounded per stage, because a stage is raised on its own and the figure on that bill has to be a whole number of paisa.
    const odd = milestoneAmountPaisa(1_000_000_01, 33)

    expect(Number.isInteger(odd)).toBe(true)
    expect(odd).toBe(Math.round((1_000_000_01 * 33) / 100))
  })

  it('moves with the contract, because it is a share of it and not a figure of its own', () => {
    // The whole reason nothing is stored: a re-measurement changes the contract, and every stage follows without being touched.
    expect(milestoneAmountPaisa(1_200_000_00, 25)).toBe(300_000_00)
    expect(milestoneAmountPaisa(1_260_000_00, 25)).toBe(315_000_00)
  })
})

describe('what the stages add up to', () => {
  it('is shown, whatever it comes to', () => {
    // Not a hundred, and that is a real contract rather than an error: a stage nobody planned or a re-measurement leaves them adding to something else.
    expect(percentAgreedSoFar([{ percent: 25 }, { percent: 40 }, { percent: 20 }])).toBe(85)
  })

  it('is shown when it is more than a hundred too', () => {
    expect(percentAgreedSoFar([{ percent: 60 }, { percent: 55 }])).toBe(115)
  })

  it('is nothing when there are no stages yet', () => {
    expect(percentAgreedSoFar([])).toBe(0)
  })
})

describe('what a stage may be', () => {
  const stage = { description: 'On completion of grey structure', percent: '25' }

  it('takes a share written the way a person writes one', () => {
    expect(milestoneInput.parse({ ...stage, percent: '25%' }).percent).toBe(25)
  })

  it.each([
    ['nothing', '0'],
    ['more than the whole contract', '101'],
    ['below nothing', '-25'],
    ['words', 'a quarter'],
  ])('refuses a share of %s', (_case, share) => {
    const checked = milestoneInput.safeParse({ ...stage, percent: share })

    expect(checked.success).toBe(false)
    expect(checked.error?.issues[0]?.message).toBe('Put in a share between nothing and a hundred percent.')
  })

  it('refuses a stage nobody described', () => {
    expect(milestoneInput.safeParse({ ...stage, description: ' ' }).success).toBe(false)
  })

  it('is not billed until it is', () => {
    expect(milestoneInput.parse(stage).billedOn).toBeUndefined()
  })
})
