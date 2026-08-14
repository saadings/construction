import { describe, expect, it } from 'vitest'

import { CANONICAL_TRADES } from './seed'

describe('the trades a site can spend on', () => {
  it('has no two trades with the same name', () => {
    // The workbooks accumulated 66 labels for roughly 45 real trades. The point of this list is not doing that again.
    const names = CANONICAL_TRADES.map((trade) => trade.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('keeps the two most likely to be mistaken for noise', () => {
    const names = CANONICAL_TRADES.map((trade) => trade.name)

    expect(names).toContain('Graphy')
    expect(names).toContain('Corian')
  })

  it('separates buying the land from building on it', () => {
    const notBuilding = CANONICAL_TRADES.filter((trade) => !trade.countsAsBuildingCost).map((trade) => trade.name)

    expect(notBuilding).toEqual(['Plot', 'Plot taxes and transfer fees', 'Dealer commission'])
  })

  it('keeps the land, the government and the agent apart', () => {
    // One bucket would answer "what did the plot cost" and never "how much was commission". Splitting later means typing ten years in again.
    const notBuilding = CANONICAL_TRADES.filter((trade) => !trade.countsAsBuildingCost)

    expect(notBuilding).toHaveLength(3)
  })

  it('counts ordinary work as building cost', () => {
    // The control. If everything were false the split above would still pass.
    expect(CANONICAL_TRADES.find((trade) => trade.name === 'Civil labour')?.countsAsBuildingCost).toBe(true)
    expect(CANONICAL_TRADES.filter((trade) => trade.countsAsBuildingCost).length).toBeGreaterThan(40)
  })

  it('has somewhere to put a payment that fits nowhere else', () => {
    expect(CANONICAL_TRADES.map((trade) => trade.name)).toContain('Other')
  })

  it('names no trade in a way a person would not recognise', () => {
    for (const { name } of CANONICAL_TRADES) {
      expect(name).not.toMatch(/\b(category|entity|record|misc|vendor|ledger)\b/i)
      expect(name[0]).toBe(name[0]?.toUpperCase())
    }
  })
})
