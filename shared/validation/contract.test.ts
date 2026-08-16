import { describe, expect, it } from 'vitest'

import { areaThatCounts, contractInput, contractValuePaisa } from './contract'

const aLumpSum = { priced: { how: 'lumpSum', totalPaisa: 1_200_000_00 }, agreedAreaSqft: 5_000 } as const
const aRate = { priced: { how: 'ratePerSqft', ratePerSqftPaisa: 2_400_00 }, agreedAreaSqft: 5_000 } as const

describe('what a contract is worth', () => {
  it('is the sum agreed, when a sum was agreed', () => {
    expect(contractValuePaisa(aLumpSum)).toBe(1_200_000_00)
  })

  it('is the rate against the area, when a rate was agreed', () => {
    expect(contractValuePaisa(aRate)).toBe(2_400_00 * 5_000)
  })

  it('follows the measured area once anyone has measured', () => {
    // The point of holding both: a re-measurement is this line, not a rebuilt row.
    const measured = { ...aRate, actualAreaSqft: 5_250 }

    expect(areaThatCounts(measured)).toBe(5_250)
    expect(contractValuePaisa(measured)).toBe(2_400_00 * 5_250)
  })

  it('leaves a lump sum alone when the house measures differently', () => {
    // The other half. A sum agreed is a sum agreed, whatever the tape says afterwards.
    expect(contractValuePaisa({ ...aLumpSum, actualAreaSqft: 5_250 })).toBe(1_200_000_00)
  })

  it('is whole paisa even when the area is not whole feet', () => {
    // Rounded once, at the end. A rate against 5,250.5 square feet is not a whole number of paisa.
    const odd = { ...aRate, actualAreaSqft: 5_250.5 }

    expect(Number.isInteger(contractValuePaisa(odd))).toBe(true)
    expect(contractValuePaisa(odd)).toBe(Math.round(2_400_00 * 5_250.5))
  })
})

describe('how a contract may be priced', () => {
  const agreed = { personId: 'p1', agreedOn: '2026-03-14', agreedAreaSqft: '5,000' }

  it('takes a lump sum, in the rupees a person types', () => {
    const contract = contractInput.parse({ ...agreed, priced: { how: 'lumpSum', totalPaisa: '1,200,000' } })

    expect(contract.priced).toEqual({ how: 'lumpSum', totalPaisa: 1_200_000_00 })
    expect(contract.agreedAreaSqft).toBe(5_000)
  })

  it('takes a rate, and cannot be handed a total beside it', () => {
    // Structural, not checked: the lump-sum shape has no rate and the rate shape has no total, so neither can be left behind when the other changes.
    const both = contractInput.safeParse({
      ...agreed,
      priced: { how: 'ratePerSqft', ratePerSqftPaisa: '2,400', totalPaisa: '1,200,000' },
    })

    expect(both.success).toBe(true)
    expect(both.data?.priced).toEqual({ how: 'ratePerSqft', ratePerSqftPaisa: 2_400_00 })
    expect(both.data?.priced).not.toHaveProperty('totalPaisa')
  })

  it.each([
    ['a rate below nothing', { how: 'ratePerSqft', ratePerSqftPaisa: '-2,400' }],
    ['a rate of nothing', { how: 'ratePerSqft', ratePerSqftPaisa: '0' }],
    ['a sum below nothing', { how: 'lumpSum', totalPaisa: '-1,200,000' }],
  ])('refuses %s', (_case, priced) => {
    // `money` allows a minus because a payment can come back out. A price cannot, and a rate of minus two thousand four hundred is a contract worth less than nothing.
    const checked = contractInput.safeParse({ ...agreed, priced })

    expect(checked.success).toBe(false)
  })

  it('refuses a way of pricing it has never heard of', () => {
    expect(contractInput.safeParse({ ...agreed, priced: { how: 'whatever', totalPaisa: '1' } }).success).toBe(false)
  })

  it.each([
    ['99', 'a hand slipping off the keypad'],
    ['20001', 'larger than any house in ten years of workbooks'],
    ['nonsense', 'words'],
  ])('refuses an area of %o, which is %s', (area) => {
    const checked = contractInput.safeParse({
      ...agreed,
      agreedAreaSqft: area,
      priced: { how: 'lumpSum', totalPaisa: '1,200,000' },
    })

    expect(checked.success).toBe(false)
    expect(checked.error?.issues[0]?.message).toBe('Put in the area in square feet.')
  })

  it('leaves the measured area off until someone measures', () => {
    const contract = contractInput.parse({ ...agreed, priced: { how: 'lumpSum', totalPaisa: '1,200,000' } })

    expect(contract.actualAreaSqft).toBeUndefined()
  })
})
