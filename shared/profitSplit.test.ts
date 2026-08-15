import { describe, expect, it } from 'vitest'

import { THE_WHOLE, proportionalTo, shareOut } from './profitSplit'

const A = 'person_a'
const B = 'person_b'
const C = 'person_c'

function adds(parts: Array<{ paisa: number }>): number {
  return parts.reduce((sum, part) => sum + part.paisa, 0)
}

describe('a share worked out from what was put in', () => {
  it('is what each partner put in, as a part of what everyone put in', () => {
    const shares = proportionalTo([
      { personId: A, paisa: 6_000_000 },
      { personId: B, paisa: 2_000_000 },
      { personId: C, paisa: 2_000_000 },
    ])

    expect(shares).toEqual([
      { personId: A, basisPoints: 6_000 },
      { personId: B, basisPoints: 2_000 },
      { personId: C, basisPoints: 2_000 },
    ])
  })

  it('comes to the whole even when it does not divide, to the last basis point', () => {
    // Three equal partners: 3333 each leaves one basis point over, and a share that quietly loses it is a share of something that is not the whole.
    const shares = proportionalTo([
      { personId: A, paisa: 1_000_000 },
      { personId: B, paisa: 1_000_000 },
      { personId: C, paisa: 1_000_000 },
    ])

    expect(shares.reduce((sum, share) => sum + share.basisPoints, 0)).toBe(THE_WHOLE)
    // The odd point goes to whoever put the most in, and three who put in the same are settled by name.
    expect(shares).toEqual([
      { personId: A, basisPoints: 3_334 },
      { personId: B, basisPoints: 3_333 },
      { personId: C, basisPoints: 3_333 },
    ])
  })

  it('is nothing at all until somebody has put something in', () => {
    // An even split would be an answer nobody agreed to.
    expect(proportionalTo([{ personId: A, paisa: 0 }])).toEqual([])
    expect(proportionalTo([])).toEqual([])
  })
})

describe('money split by a share', () => {
  it('gives each of them their part, in whole paisa', () => {
    const parts = shareOut(1_000_000, [
      { personId: A, basisPoints: 6_000 },
      { personId: B, basisPoints: 4_000 },
    ])

    expect(parts).toEqual([
      { personId: A, paisa: 600_000 },
      { personId: B, paisa: 400_000 },
    ])
  })

  it('adds back up to exactly what was split, however it divides', () => {
    // The property this exists for. Paisa lost in rounding are paisa somebody is owed, and they are lost silently.
    for (const paisa of [1, 7, 100, 100_001, 6_057_704, 999_999_999]) {
      const parts = shareOut(paisa, [
        { personId: A, basisPoints: 3_334 },
        { personId: B, basisPoints: 3_333 },
        { personId: C, basisPoints: 3_333 },
      ])

      expect(adds(parts), `${paisa} did not come back to itself`).toBe(paisa)
    }
  })

  it('hands the remainder to the largest share, on purpose and the same way twice', () => {
    const parts = shareOut(100, [
      { personId: B, basisPoints: 3_333 },
      { personId: A, basisPoints: 3_334 },
      { personId: C, basisPoints: 3_333 },
    ])

    expect(parts.find((part) => part.personId === A)?.paisa).toBe(34)
    expect(adds(parts)).toBe(100)
  })

  it('splits nothing into nothing rather than into something', () => {
    // A house that has not made a profit owes nobody a share of one.
    expect(shareOut(0, [{ personId: A, basisPoints: THE_WHOLE }])).toEqual([{ personId: A, paisa: 0 }])
    expect(shareOut(-500_000, [{ personId: A, basisPoints: THE_WHOLE }])).toEqual([{ personId: A, paisa: 0 }])
  })

  it('reads a share of the whole from what the shares themselves come to', () => {
    // Two partners holding half the house between them get half of it each, not a quarter: the split is over what was declared, and what is missing is not silently anybody's.
    const parts = shareOut(1_000_000, [
      { personId: A, basisPoints: 2_500 },
      { personId: B, basisPoints: 2_500 },
    ])

    expect(parts).toEqual([
      { personId: A, paisa: 500_000 },
      { personId: B, paisa: 500_000 },
    ])
  })
})
