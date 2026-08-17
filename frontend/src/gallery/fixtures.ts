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

// It is a function and not a constant, and that is the whole of what keeps it measurable. As a constant its `paisa()` calls ran once at import, so `nothingMeansTwoThings` -- which finds two ideas rendering one string by nudging each call and watching what moves -- nudged nothing on this screen and reported it clean. Two independent literals were planted rendering `12,840,000` twice on the Dashboard and it passed.

// Which is the failure this repository keeps finding from a new direction: not a guard that is wrong, a guard whose subject quietly left its reach. The screen has been outside it since the fixture moved out of `screens.tsx`, and nothing said so.
export function everythingAtOnce() {
  // Written once and read three times: the tile says what went out this month, the chart header says the total of its own rows, and the sentence under the other chart may name this month too. Those are one number on the screen, so they are one number here.

  // Not an assertion. `theFixtureAddsUp` could say the tile equals the sum of the rows, and it did -- but a fixture that cannot contradict itself is stronger than one that is asked whether it has, and an assertion that construction has already made true is an assertion that cannot fail.
  const thisMonth = [
    { tradeId: 't1', name: 'Grey structure', paisa: paisa(1_240_000) },
    { tradeId: 't2', name: 'Steel', paisa: paisa(845_500) },
    { tradeId: 't3', name: 'Tiles', paisa: paisa(512_300) },
    { tradeId: 't4', name: 'Electrical', paisa: paisa(398_600) },
    { tradeId: null, name: 'Everything else (3)', paisa: paisa(290_000) },
  ]

  const paidOutPaisa = thisMonth.reduce((total, one) => total + one.paisa, 0)
  const receivedPaisa = paisa(1_225_000)

  return {
    // Fixed rather than today's, like `A_DAY` and for the same reason: a screen whose heading says which day it is takes a different picture every morning, and two pictures that differ are two pictures nobody can compare.
    asAt: A_DAY,
    owed: { payablePaisa: paisa(3_412_500), advancedPaisa: paisa(265_000), people: 4 },
    goneOutPaisa: paisa(19_938_452),
    comeIn: { receivedPaisa: paisa(22_150_000), ownMoneyPaisa: paisa(6_540_000) },
    // The month `asAt` falls in, and the month the two tiles and the category chart are all about.
    thisMonth: { month: '2026-07', paidOutPaisa, entries: 47, receivedPaisa },
    whereItWent: thisMonth,
    // Six months as he drew them, and a window rather than the whole ledger -- so these come to less than what has come in and gone out altogether, which is a thing the rule below asks about rather than assumes.

    // The last pair is this month again, by construction for the same reason: his sentence names the heaviest month, and on a month where that is this one the columns and the tiles would be two claims about one figure.
    inAndOut: [
      { month: '2026-02', inPaisa: paisa(1_375_000), outPaisa: paisa(1_842_300) },
      { month: '2026-03', inPaisa: paisa(5_100_000), outPaisa: paisa(4_216_700) },
      { month: '2026-04', inPaisa: paisa(2_410_000), outPaisa: paisa(2_975_400) },
      { month: '2026-05', inPaisa: paisa(4_860_000), outPaisa: paisa(3_104_900) },
      { month: '2026-06', inPaisa: paisa(5_780_000), outPaisa: paisa(2_518_600) },
      { month: '2026-07', inPaisa: receivedPaisa, outPaisa: paidOutPaisa },
    ],
    // Two days in the week before `asAt` with nothing entered against them, which is the one row of `Needs your attention` this ledger can answer.
    quietDays: ['2026-07-20', '2026-07-21'],
    houses: [
      {
        siteId: 's1',
        name: THE_HOUSE,
        stage: 'building',
        builtForAClient: true,
        // Lower case because it lands mid-sentence -- `For the family it is for` -- and every other invented name here is a subject rather than an object. Nauman's own drawing has a person's name in this slot, which reads without any of this; the fixture cannot have one.
        forWhom: 'the family it is for',
        coveredAreaSqft: 5_400,
        goneOutPaisa: paisa(11_798_452),
        comeInPaisa: paisa(9_310_000),
      },
      {
        siteId: 's2',
        name: '204-C, Phase 6',
        stage: 'sold',
        // Built to sell rather than for anybody, which is what the flag on a site means. It is why the line has three shapes and not two: this one says `Own build, for sale`, and a house built for a client nobody has named says so instead.
        builtForAClient: false,
        forWhom: null,
        coveredAreaSqft: 4_500,
        goneOutPaisa: paisa(8_140_000),
        comeInPaisa: paisa(12_840_000),
      },
      // The one nought this fixture can afford, spent on the state he is in on his first day: a house started with nothing entered against it. Two noughts that move independently are two ideas rendering one string, which is what `nothingMeansTwoThings` refuses.

      // And a house with neither half of its line, because a house on the day it is started has a name and nothing else.
      {
        siteId: 's3',
        name: '12-B, Phase 3',
        stage: 'planning',
        // Built for somebody, and nobody entered who. The third shape of that line, and the state a house is really in for the first day or two.
        builtForAClient: true,
        forWhom: null,
        coveredAreaSqft: null,
        goneOutPaisa: 0,
        comeInPaisa: 0,
      },
    ],
    nothingYet: false,
  }
}
