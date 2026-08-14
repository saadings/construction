// Figures from a real workbook, carrying no person's name, mobile number, bank account or cheque number — the sheets hold all four.
import { rupeesToPaisa } from '../money'

/** What a trade cost on this site, as the sheet records it, in rupees. */
export type TradeSpend = { trade: string; rupees: number; countsAsBuildingCost: boolean }

// Two of the sheet's trade columns disagree with the payments beneath them, so this carries both numbers rather than the stated one.
export const CLIENT_SITE_SPEND: Array<TradeSpend> = [
  { trade: 'Civil labour', rupees: 1_062_800, countsAsBuildingCost: true },
  { trade: 'Bricks', rupees: 786_000, countsAsBuildingCost: true },
  { trade: 'Cement', rupees: 859_280, countsAsBuildingCost: true },
  { trade: 'Crush', rupees: 336_800, countsAsBuildingCost: true },
]

/** Paid, recorded against a trade, and never counted in the sheet's own construction total. */
export const PAID_BUT_NEVER_COUNTED = { trade: 'Supervision charges', rupees: 900_000, payments: 6 }

/** Counted in the sheet's construction total with no payment anywhere behind it. */
export const COUNTED_WITH_NOTHING_BEHIND_IT = { trade: 'Landscaping', rupees: 1_000_000, payments: 0 }

/** What the sheet says, and what its own payments say. The app must reach the second. */
export const CONSTRUCTION_EXPENDITURE = {
  /** The figure written on the sheet. Never assert this: it is the recomputed one plus a plug and minus a real cost. */
  asTheSheetStatesIt: 11_898_452,
  /** Every payment the sheet records, added up. 267 of them. */
  asItsOwnPaymentsAddUp: 11_798_452,
}

/** A register kept by hand beside the ledger, which the app replaces with a sum over what everyone is still owed. */
export const MARKET_PAYABLES = {
  /** Thirteen rows on the sheet. Ten are settled and carry nothing; these three are what is left. */
  outstanding: [
    { owed: 'Dura Tiles', rupees: 763_701 },
    { owed: 'Kabinet King', rupees: 770_000 },
    { owed: 'Uncategorised', rupees: 58_000 },
  ],
  stated: 1_591_701,
  /** A number sitting in the amount column with no one beside it. The sheet's own total leaves it out, correctly. */
  strayUnlabelledAmount: 455,
}

/** Receipts and the closing position, which the sheet computes and the app must reach the same way. */
export const CLIENT_POSITION = {
  receivedInCash: 9_152_000,
  spentByAPartnerOnTheClientsBehalf: 2_382_570,
  totalReceipts: 11_534_570,
  /** Negative because more has been spent than received. An advance is not an error and must not clamp at zero. */
  stillReceivable: -1_955_583,
}

export function totalPaisa(spend: Array<TradeSpend>): number {
  return spend.reduce((running, line) => running + rupeesToPaisa(line.rupees), 0)
}
