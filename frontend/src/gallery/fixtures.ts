import { CLIENT_SITE_SPEND, MARKET_PAYABLES } from '~shared/fixtures/oneClientSite'
import { rupeesToPaisa } from '~shared/money'

// Everyone in the gallery is invented. The figures are not: they come from `oneClientSite`, which carries what a real workbook records and no person's name, mobile, account or cheque number, because the sheets hold all four.

// This file ends up on a screen somebody photographs, so the rule is stricter here than anywhere else in the repository: nothing copied out of a workbook that names anybody.

/** The people, named for what they do on the house rather than after anyone. */
export const NOBODY = [
  { _id: 'p1', name: 'The one who started it' },
  { _id: 'p2', name: 'The one who came in later' },
  { _id: 'p3', name: 'The mason' },
  { _id: 'p4', name: 'The tile shop' },
  { _id: 'p5', name: 'The kitchen people' },
] as const

export const TRADES = [
  { _id: 't1', name: 'Civil labour', countsAsBuildingCost: true },
  { _id: 't2', name: 'Bricks', countsAsBuildingCost: true },
  { _id: 't3', name: 'Cement', countsAsBuildingCost: true },
  { _id: 't4', name: 'Crush', countsAsBuildingCost: true },
  { _id: 't5', name: 'Supervision charges', countsAsBuildingCost: false },
]

export const BANK = [
  { _id: 'b1', label: 'Bank 4021', lastFourDigits: '4021' },
  { _id: 'b2', label: 'Bank 7788', lastFourDigits: '7788' },
]

export const THE_HOUSE = '1-A, Phase 0'

// After the twelfth on purpose: `2026-07-04` reads as the fourth of July in one order and the seventh of April in the other, so a picture of the app writing days his way and a picture of it writing them the other way are the same picture -- and a screenshot that cannot tell two states apart is not evidence, it is a reassuring image.

/** A day in the middle of the work, fixed rather than today's, so two screenshots a week apart are the same picture. */
export const A_DAY = '2026-07-23'

export const paisa = rupeesToPaisa

/** What the four sampled trades cost, which is what the spending screens add up. */
export const SPEND = CLIENT_SITE_SPEND

/** The three rows still outstanding in the register kept beside the ledger. */
export const STILL_OWED = MARKET_PAYABLES.outstanding
