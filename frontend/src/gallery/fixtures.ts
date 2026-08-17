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

// Everything the Dashboard is drawn from, and it lives here rather than inline in `screens.tsx` for two reasons that turned out to be the same reason.

// It has to add up. The tile says what has come in altogether and the months say where it came from, and in the app both come out of one pass over the same rows so they cannot disagree -- in a fixture they are two hand-written claims about the same money, and nothing had ever asked whether they agreed. They did not: the months came to 24,510,000 against a tile saying 22,150,000, and the own-money months to 7,525,000 against a tile saying 6,540,000.

// Nobody wrote a wrong number. It reconciled to the rupee until two of those months held a nought, `nothingMeansTwoThings` refused two noughts it could not tell apart, and the fix for that guard gave them values -- which is a fix for one rule quietly breaking an invariant no rule held. `theFixtureAddsUp` holds it now.

// And `Reports` reads two of these figures rather than repeating them. It showed `6,540,000` of its own, which was the same stale number, and two screens hand-writing one figure is the thing that can disagree about it while both look right.
export const EVERYTHING_AT_ONCE = {
  owed: { payablePaisa: paisa(3_412_500), advancedPaisa: paisa(265_000) },
  goneOutPaisa: paisa(19_938_452),
  comeIn: { receivedPaisa: paisa(22_150_000), ownMoneyPaisa: paisa(6_540_000) },
  whereItWent: [
    { tradeId: 't1', name: 'Grey structure', paisa: paisa(8_120_000) },
    { tradeId: 't2', name: 'Steel', paisa: paisa(4_755_000) },
    { tradeId: 't3', name: 'Tiles', paisa: paisa(2_310_000) },
    { tradeId: 't4', name: 'Electrical', paisa: paisa(1_845_500) },
    { tradeId: null, name: 'Everything else', paisa: paisa(2_907_952) },
  ],
  whatCameIn: [
    { month: '2026-04', ownMoneyPaisa: paisa(1_650_000), broughtInPaisa: paisa(1_375_000) },
    { month: '2026-05', ownMoneyPaisa: paisa(1_240_000), broughtInPaisa: paisa(5_100_000) },
    { month: '2026-06', ownMoneyPaisa: paisa(2_665_000), broughtInPaisa: paisa(5_850_000) },
    { month: '2026-07', ownMoneyPaisa: paisa(985_000), broughtInPaisa: paisa(3_285_000) },
  ],
  houses: [
    {
      siteId: 's1',
      name: THE_HOUSE,
      stage: 'building',
      goneOutPaisa: paisa(11_798_452),
      comeInPaisa: paisa(9_310_000),
    },
    {
      siteId: 's2',
      name: '204-C, Phase 6',
      stage: 'sold',
      goneOutPaisa: paisa(8_140_000),
      comeInPaisa: paisa(12_840_000),
    },
    // The one nought this fixture can afford, spent on the state he is in on his first day: a house started with nothing entered against it. Two noughts that move independently are two ideas rendering one string, which is what `nothingMeansTwoThings` refuses.
    { siteId: 's3', name: '12-B, Phase 3', stage: 'planning', goneOutPaisa: 0, comeInPaisa: 0 },
  ],
  nothingYet: false,
}
