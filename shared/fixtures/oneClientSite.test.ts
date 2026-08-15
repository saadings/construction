import { describe, expect, it } from 'vitest'

import { paisaToRupees, rupeesToPaisa } from '../money'
import {
  CLIENT_POSITION,
  CLIENT_SITE_SPEND,
  CONSTRUCTION_EXPENDITURE,
  COUNTED_WITH_NOTHING_BEHIND_IT,
  MARKET_PAYABLES,
  PAID_BUT_NEVER_COUNTED,
  totalPaisa,
} from './oneClientSite'

// A fixture is used to judge the calculations, so a wrong one condemns correct code. These check the fixture, not the app.

describe('what one client site already adds up to', () => {
  it('reaches the register total from the three balances still outstanding', () => {
    const outstanding = MARKET_PAYABLES.outstanding.reduce((running, line) => running + rupeesToPaisa(line.rupees), 0)

    expect(paisaToRupees(outstanding)).toBe(MARKET_PAYABLES.stated)
  })

  it('leaves the stray amount out, the way the sheet total does', () => {
    const withTheStray = MARKET_PAYABLES.stated + MARKET_PAYABLES.strayUnlabelledAmount

    // Included it would be 1,592,156. The sheet says 1,591,701, so the number beside nobody is not part of the answer.
    expect(withTheStray).not.toBe(MARKET_PAYABLES.stated)
    expect(withTheStray).toBe(1_592_156)
  })

  it('explains the gap between what the sheet states and what its payments add up to', () => {
    const { asTheSheetStatesIt, asItsOwnPaymentsAddUp } = CONSTRUCTION_EXPENDITURE

    // A million counted with nothing behind it and nine hundred thousand never counted nearly cancel, which is why nobody noticed.
    expect(asTheSheetStatesIt - asItsOwnPaymentsAddUp).toBe(
      COUNTED_WITH_NOTHING_BEHIND_IT.rupees - PAID_BUT_NEVER_COUNTED.rupees
    )
  })

  it('holds a plug figure the app must make impossible to enter', () => {
    // There is no box anywhere for correcting a total, so a trade total with no payments behind it cannot arise.
    expect(COUNTED_WITH_NOTHING_BEHIND_IT.payments).toBe(0)
    expect(COUNTED_WITH_NOTHING_BEHIND_IT.rupees).toBeGreaterThan(0)
  })

  it('reaches the closing position from the receipts and the spending', () => {
    const receipts = CLIENT_POSITION.receivedInCash + CLIENT_POSITION.spentByAPartnerOnTheClientsBehalf

    expect(receipts).toBe(CLIENT_POSITION.totalReceipts)
    // Total expenditure is the construction figure plus what is still owed to the market.
    expect(receipts - (CONSTRUCTION_EXPENDITURE.asTheSheetStatesIt + MARKET_PAYABLES.stated)).toBe(
      CLIENT_POSITION.asTheSheetClosesIt
    )
  })

  it('reaches a different closing position from the payments, which is the one the app will produce', () => {
    // The sheet closes through its stated construction figure, and that figure carries the plug. Asserting the app against it would condemn correct code.
    const receipts = CLIENT_POSITION.totalReceipts

    expect(receipts - (CONSTRUCTION_EXPENDITURE.asItsOwnPaymentsAddUp + MARKET_PAYABLES.stated)).toBe(
      CLIENT_POSITION.asItsOwnPaymentsAddUp
    )
  })

  it('is apart by the plug less what was never counted, and by nothing else', () => {
    // The two closing figures differ for one reason, and naming it is what stops either being adjusted to match the other.
    const apart = CLIENT_POSITION.asTheSheetClosesIt - CLIENT_POSITION.asItsOwnPaymentsAddUp

    expect(apart).toBe(PAID_BUT_NEVER_COUNTED.rupees - COUNTED_WITH_NOTHING_BEHIND_IT.rupees)
    expect(apart).toBe(-100_000)
  })

  it('carries a closing position that is negative rather than clamped, whichever way it is reached', () => {
    expect(CLIENT_POSITION.asTheSheetClosesIt).toBeLessThan(0)
    expect(CLIENT_POSITION.asItsOwnPaymentsAddUp).toBeLessThan(0)
  })

  it('converts every figure it holds to whole paisa', () => {
    // The control: a fixture in rupees that cannot survive the conversion would fail the calculations for the wrong reason.
    for (const line of CLIENT_SITE_SPEND) expect(Number.isInteger(rupeesToPaisa(line.rupees))).toBe(true)

    expect(paisaToRupees(totalPaisa(CLIENT_SITE_SPEND))).toBe(3_044_880)
  })
})
