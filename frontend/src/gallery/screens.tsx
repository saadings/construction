import type { ReactNode } from 'react'
import { useState } from 'react'

import { Dashboard } from '../components/dashboard/Dashboard'
import { DaySheet } from '../components/daySheet/DaySheet'
import { WhoCanSignIn } from '../components/invites/WhoCanSignIn'
import { ComingIn } from '../components/moneyIn/ComingIn'
import { EverythingThatCameIn } from '../components/moneyIn/EverythingThatCameIn'
import { WhatHasComeIn } from '../components/moneyIn/WhatHasComeIn'
import { WhatWeOwe } from '../components/owed/WhatWeOwe'
import { AgreeShares } from '../components/partners/AgreeShares'
import { Positions } from '../components/partners/Positions'
import { People } from '../components/people/People'
import { TheirAccount } from '../components/people/TheirAccount'
import { Reports } from '../components/reports/Reports'
import { Finding, WayToFind } from '../components/search/Finding'
import { BankAccounts } from '../components/settings/BankAccounts'
import { HowItLooks } from '../components/settings/HowItLooks'
import { TheSettings } from '../components/settings/TheSettings'
import { Trades } from '../components/settings/Trades'
import { PayOut } from '../components/shares/PayOut'
import { Page } from '../components/shell/Page'
import { Shell } from '../components/shell/Shell'
import { TheNav, TheNavOnAPhone } from '../components/shell/TheNav'
import { WayIn } from '../components/shell/WayIn'
import { AgreeAContract } from '../components/site/AgreeAContract'
import { ChangeTheContract } from '../components/site/ChangeTheContract'
import { ExtraWork } from '../components/site/ExtraWork'
import { SpentByTrade } from '../components/site/SpentByTrade'
import { Stages } from '../components/site/Stages'
import { WhoIsOnThisHouse } from '../components/site/WhoIsOnThisHouse'
import { ChangeTheHouse } from '../components/sites/ChangeTheHouse'
import { HouseDetails } from '../components/sites/HouseDetails'
import { SitesList } from '../components/sites/SitesList'
import { A_DAY, BANK, NOBODY, STILL_OWED, THE_HOUSE, TRADES, everythingAtOnce, paisa } from './fixtures'

// Every screen a route draws whole, with invented figures, so somebody can look at one without signing in.

// What each screen proves is the words that screen really shows, so a marker here is a claim about somebody else's file. Twelve of these draw components in the other half of the vocabulary rename -- `daySheet/`, `moneyIn/`, `site/`, `form/` -- and their markers say what those screens say **today**. They move in that half's change, in the same commit as the label they name, or this gallery photographs a screen it has already renamed in its head.

// The list is what the gallery is: a screen missing from it is a screen nobody looks at, and a gallery of eleven looks exactly like a gallery of twelve. `everyScreenIsHere.test.ts` is what stops that, and it reads this file.

/** A screen, named the way somebody would ask for it. */
export type OnShow = {
  /** What goes in the address bar after the `#`. */
  slug: string
  /** What it is called on the screen it is on, so the gallery and the app agree. */
  name: string
  /** Where somebody reaches it in the app, so a screenshot can be placed. */
  where: string
  /** The address pattern it really has, so it is drawn where it lives: a trail is read off the pattern it was matched at, and a screen drawn at `/` shows none. A part of a screen takes the address of the screen it is part of, and a `$param` stays a `$param` -- matching at `/sites/s1/shares` rather than `/sites/$siteId/shares` is what made the trail vanish from three screens while every test passed. */
  at: string
  /** The screen this is one section of, when it is not a whole screen itself. The house screen composes its page out of several parts rather than drawing one component, so the gallery cannot reach it whole -- and four tables on it were unmeasured for exactly that reason. A part is drawn inside the same `Page` the route puts it in, so what is measured is the width it really has. */
  partOf?: string
  /** How long the words a screen proves take to arrive, for the two screens whose whole subject is a wait. A send that has not come back speaks after eight seconds and a reading that has not arrived after twelve -- the harness waited a second, which is the same "nothing there" this pair is about. */
  provesAfter?: number
  /** What to tap before the picture is taken, in order, for a screen that keeps itself folded up until somebody asks. A list, because a destructive control lives two taps in -- a way out, then the are-you-sure behind it -- and every screen was photographed at rest, so that half of them had never been on the page while anything measured. */
  tapFirst?: Array<string>
  /** Where this screen's markup ends up, when it is not inside the element the gallery draws screens into. Below 768 the nav is a sheet, and Radix puts a sheet in a portal on `body` -- outside `[data-testid="the-screen"]` entirely. Nothing was wrong with the marker or the timing: the camera was looking inside an element the screen had left. */
  shownIn?: string
  /** Words this screen shows and no other does. A gallery that answered every address with the first screen would otherwise draw twelve pictures of one, and every one of them would look right. */
  proves: string
  draw: () => ReactNode
}

// Nothing here goes anywhere. The screens ask for callbacks and the gallery has no ledger behind it, so each one answers and does nothing -- which is why the page says out loud that it is scaffolding.
const nothing = () => Promise.resolve()
const nothingTrue = () => Promise.resolve(true)

// The sheet that had to be held open for a photograph is gone with the design: below 768 the nav is a strip that is simply on the page, so nothing has to be opened before it can be measured. That is a small thing the redesign gives back -- the state a picture had to be put into was the state a person had to put it into too.

// Clerk's `SignInButton` in the app and this in the gallery, because nothing here may reach a deployment. It stands in for the wrapper and not for the button: Clerk's own hangs an `onClick` on whatever is inside it and draws no box, so what is measured here is the button the app ships rather than a copy of it kept in step by hand.
function AsClerkWouldOpenIt({ children }: { children: ReactNode }) {
  return children
}

// The search, with the names invented and the reading already done. What the app draws is `TheSearch`, which holds the open state and reads the ledger for them -- and the gallery has no ledger, which is exactly why the reading and the drawing are two components.

// Its own state rather than a prop, because a dialog that starts closed is a picture of a page with nothing on it, and `tapFirst` is what opens it.

// The shell with its two providers stood in for and nothing else changed. The account is a circle the size the shell asked for, so what is measured is the box the real one is given rather than a copy of the real one kept in step by hand -- and `chrome.test` is what asks whether the app hands over Clerk's own.
function TheShellAsDrawn() {
  return (
    <Shell
      account={(avatar) => <span className={`bg-brass block rounded-full ${avatar}`} />}
      who="Nauman Yousaf"
      finding={<TheSearchAsDrawn />}
    >
      <Page title="Dashboard">
        <p className="text-muted-foreground max-w-prose">
          Whatever screen you are on sits here. This picture is of the frame around it.
        </p>
      </Page>
    </Shell>
  )
}

function TheSearchAsDrawn() {
  const [open, setOpen] = useState(false)

  return (
    <div className="p-3">
      <WayToFind
        onOpen={() => {
          setOpen(true)
        }}
      />
      <Finding
        found={[
          { id: 's1', name: THE_HOUSE, what: 'House', to: '/sites/s1' },
          { id: 's2', name: '204-C, Phase 6', what: 'House', to: '/sites/s2' },
          { id: 'p1', name: 'The tile shop', what: 'Person', to: '/people/p1' },
          { id: 'p2', name: 'The one who started it', what: 'Person', to: '/people/p2' },
        ]}
        open={open}
        onOpen={setOpen}
      />
    </div>
  )
}

export const ON_SHOW: Array<OnShow> = [
  {
    slug: 'the-way-in',
    // No trail and no nav: this is drawn in place of the whole app, whatever address was asked for.
    at: '/',
    name: 'The way in',
    where: 'the first screen anybody sees, before they have signed in',
    proves: 'Sign in',
    // The screen every other picture assumes somebody has got past. It was drawn by nothing and photographed at no width, because Clerk will not render outside its own provider -- so the exemption that was about a wrapper covered a whole screen, and the one screen he cannot get past if it is wrong was the one nothing had looked at.
    draw: () => <WayIn opens={AsClerkWouldOpenIt} />,
  },
  {
    slug: 'dashboard',
    at: '/dashboard',
    name: 'Dashboard',
    where: 'the first row of the nav',
    // The whole caption, not `Outstanding`. That word is now the start of a longer one, and a camera waiting on a string that is a prefix of another string waits on whichever the page draws first.
    proves: 'Outstanding payables',
    // Every figure below is a different number on purpose. Two that happen to match make a wiring bug look like a working screen -- a tile reading the wrong field, a house's column drawn from the total -- and this has been caught twice already in fixtures that were not this careful.
    draw: () => <Dashboard what={everythingAtOnce()} />,
  },
  {
    slug: 'spent-by-trade',
    at: '/sites/$siteId',
    name: 'What it went on',
    where: 'a house, down the screen',
    partOf: 'the house screen',
    proves: 'What it went on',
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <SpentByTrade
          byTrade={[
            { tradeId: 't1', name: 'Civil labour', paisa: paisa(4_318_000) },
            { tradeId: 't2', name: 'Bricks', paisa: paisa(2_745_500) },
            { tradeId: 't3', name: 'Cement', paisa: paisa(1_960_250) },
            { tradeId: 't5', name: 'Supervision charges', paisa: paisa(415_000) },
          ]}
          onOpen={() => undefined}
          // One trade open, because the payments behind a figure are where the way out of one lives -- and a picture of this screen with nothing opened is a picture that cannot show it.
          opened={{
            tradeId: 't1',
            went: [
              {
                _id: 'w1',
                day: A_DAY,
                amountPaisa: paisa(2_650_000),
                paidToName: NOBODY[2].name,
                method: 'cheque',
                reference: '774312',
              },
              {
                _id: 'w2',
                day: '2026-06-27',
                amountPaisa: paisa(1_668_000),
                paidToName: NOBODY[2].name,
                method: 'cash',
              },
            ],
          }}
          onTakeOut={nothingTrue}
          takingOut={null}
          refusal={null}
        />
      </Page>
    ),
  },
  {
    slug: 'stages',
    at: '/sites/$siteId',
    name: 'Billed in stages',
    where: 'a house built for a client, down the screen',
    partOf: 'the house screen',
    proves: 'Billed in stages',
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <Stages
          stages={[
            {
              _id: 'm1',
              description: 'On signing',
              percent: 20,
              amountPaisa: paisa(3_640_000),
              billedOn: '2026-04-23',
            },
            { _id: 'm2', description: 'Grey structure complete', percent: 35, amountPaisa: paisa(6_370_000) },
            { _id: 'm3', description: 'Finishing complete', percent: 30, amountPaisa: paisa(5_460_000) },
          ]}
          percentAgreed={85}
          onAdd={nothing}
          onBill={nothing}
        />
      </Page>
    ),
  },
  {
    slug: 'extra-work',
    at: '/sites/$siteId',
    name: 'Extra work',
    where: 'a house built for a client, down the screen',
    partOf: 'the house screen',
    proves: 'Extra work',
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <ExtraWork
          bills={[
            {
              _id: 'b1',
              raisedOn: '2026-06-17',
              description: 'Boundary wall raised by three feet',
              totalPaisa: paisa(487_350),
              lines: [
                {
                  _id: 'l1',
                  description: 'Brickwork',
                  working: "39.75' x 0.375' x 11'",
                  quantity: 164,
                  unit: 'cft',
                  amountPaisa: paisa(311_600),
                },
                {
                  _id: 'l2',
                  description: 'Plaster, both faces',
                  working: "39.75' x 11' x 2",
                  quantity: 875,
                  unit: 'sft',
                  amountPaisa: paisa(175_750),
                },
              ],
            },
          ]}
          onRaise={nothing}
          onTakeBack={nothing}
        />
      </Page>
    ),
  },
  {
    slug: 'what-has-come-in',
    at: '/sites/$siteId',
    name: 'Come in, on one house',
    where: 'a house, down the screen',
    partOf: 'the house screen',
    proves: 'Partners put in',
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <WhatHasComeIn
          siteId="s1"
          totals={{
            byWhy: {
              partnerMoney: paisa(6_540_000),
              clientPayment: paisa(9_152_000),
              sale: paisa(0),
            },
            receivedPaisa: paisa(15_692_000),
          }}
        />
      </Page>
    ),
  },
  {
    slug: 'sites',
    at: '/',
    name: 'Sites',
    where: 'the first screen, signed in',
    proves: '204-C, Phase 6',
    draw: () => (
      <SitesList
        sites={[
          // Three houses in the three states this card has: one measured against an estimate, one **over** it, and one with no estimate at all. Every figure is different, so a card reading the wrong field cannot look like a working card.
          {
            _id: 's1',
            name: THE_HOUSE,
            stage: 'building',
            builtForAClient: false,
            spentPaisa: paisa(11_798_452),
            receivedPaisa: paisa(14_250_000),
            budgetEstimatePaisa: paisa(19_400_000),
            coveredAreaSqft: 5400,
          },
          {
            _id: 's2',
            name: '204-C, Phase 6',
            stage: 'sold',
            builtForAClient: true,
            spentPaisa: paisa(8_140_000),
            receivedPaisa: paisa(9_600_000),
            budgetEstimatePaisa: paisa(7_250_000),
            clientName: 'The one it is built for',
            coveredAreaSqft: 3175,
          },
          {
            _id: 's3',
            name: '12-B, Phase 3',
            stage: 'planning',
            builtForAClient: false,
            spentPaisa: 0,
            receivedPaisa: 0,
          },
        ]}
      />
    ),
  },
  {
    slug: 'day-sheet',
    at: '/sites/$siteId/day',
    name: 'Expenses',
    where: 'a house, then the day sheet',
    // Not `In this sitting`, which is the first thing that came to mind and is `hidden lg:block`. jsdom applies no CSS, so it passed there and the browser found it thirty-four times and never visible -- which is the gallery earning its keep before it had taken a single picture.
    proves: 'Add another',
    draw: () => (
      <DaySheet
        siteName={THE_HOUSE}
        day={A_DAY}
        onChangeDay={() => undefined}
        trades={TRADES.map((trade) => ({ _id: trade._id as never, name: trade.name }))}
        people={NOBODY.map((person) => ({ _id: person._id as never, name: person.name }))}
        accounts={BANK.map((account) => ({ _id: account._id as never, label: account.label }))}
        saving={false}
        refusal={null}
        onPutIn={nothingTrue}
        onAddAccount={() => Promise.resolve('b1' as never)}
        onAddTrade={() => Promise.resolve('t1' as never)}
      />
    ),
  },
  {
    slug: 'coming-in',
    at: '/sites/$siteId/coming-in',
    name: 'Invested',
    where: 'a house, then money coming in',
    proves: 'Invested',
    draw: () => (
      <ComingIn
        siteName={THE_HOUSE}
        received={[
          {
            _id: 'r1',
            day: A_DAY,
            amountPaisa: paisa(2_500_000),
            fromName: NOBODY[0].name,
            why: 'partnerMoney',
            reference: '774411',
          },
          { _id: 'r2', day: '2026-06-19', amountPaisa: paisa(9_152_000), fromName: 'The client', why: 'clientPayment' },
        ]}
        people={NOBODY.map((person) => ({ _id: person._id, name: person.name }))}
        accounts={BANK.map((account) => ({ _id: account._id, label: account.label }))}
        saving={false}
        refusal={null}
        onPutIn={nothingTrue}
        onTakeBack={nothing}
        onAddAccount={() => Promise.resolve('b9')}
      />
    ),
  },
  {
    slug: 'shares',
    at: '/sites/$siteId/shares',
    name: 'Partner shares',
    where: 'a house, then what each partner takes',
    proves: 'Paid out',
    // The one screen drawn as the route composes it rather than on its own: `PayOut` reaches it through `AgreeShares`'s `beneath`, and a gallery drawing the two side by side would look right with the slot deleted.
    draw: () => {
      const positions = [
        {
          personId: 'p1',
          name: NOBODY[0].name,
          capitalPaisa: paisa(6_000_000),
          basisPoints: 7_500,
          duePaisa: 0,
          paidPaisa: paisa(200_000),
          balancePaisa: -paisa(200_000),
        },
        {
          personId: 'p2',
          name: NOBODY[1].name,
          capitalPaisa: paisa(2_000_000),
          basisPoints: 2_500,
          duePaisa: 0,
          paidPaisa: 0,
          balancePaisa: 0,
        },
      ]

      return (
        <AgreeShares
          siteName={THE_HOUSE}
          what={{
            positions,
            broughtInPaisa: paisa(11_534_570),
            spentPaisa: paisa(11_798_452),
            profitPaisa: -paisa(263_882),
            sold: false,
            sharesAgreed: true,
            ifItSoldToday: {
              profitPaisa: -paisa(263_882),
              shares: positions.map((one) => ({
                personId: one.personId,
                name: one.name,
                paisa: -paisa(one.basisPoints === 7_500 ? 197_912 : 65_970),
              })),
            },
          }}
          everybody={NOBODY.map((person) => ({ _id: person._id, name: person.name }))}
          saving={false}
          refusal={null}
          onAgree={nothingTrue}
          onFollowTheMoney={nothingTrue}
          beneath={(arrived) => (
            <PayOut
              partners={arrived.positions.map((one) => ({ _id: one.personId, name: one.name }))}
              paidOut={[
                {
                  _id: 'o1',
                  day: A_DAY,
                  amountPaisa: paisa(200_000),
                  personName: NOBODY[0].name,
                  method: 'cheque',
                  reference: '774418',
                },
              ]}
              accounts={BANK.map((account) => ({ _id: account._id, label: account.label }))}
              onPayOut={nothing}
              onTakeBack={nothing}
              onAddAccount={() => Promise.resolve('b9')}
            />
          )}
        />
      )
    },
  },
  {
    slug: 'owed',
    at: '/owed',
    name: 'Payables',
    where: 'the second place in the nav',
    proves: 'Payables',
    // What is chosen and what is worked out, kept apart. `58,000` was the advance held against one supplier and also, by arithmetic, what the kitchen people were left standing -- two ideas, one string, and either could have been broken with both tests still green.

    // Every payment was also `120,000`, so an assertion about one supplier's payment matched all three rows.
    draw: () => {
      // What each of them has been paid: three figures nobody can confuse for each other or for a total.
      const paidToEach = [120_000, 96_500, 73_400]

      return (
        <WhatWeOwe
          owed={{
            payablePaisa: paisa(STILL_OWED.reduce((running, row) => running + row.rupees, 0)),
            // Chosen rather than derived, and chosen not to land on anything: an advance is money held against a supplier and has nothing to do with what any of them is owed.
            advancedPaisa: paisa(41_250),
            everyone: STILL_OWED.map((row, at) => {
              const paid = paisa(paidToEach[at] ?? 0)
              const outstanding = paisa(row.rupees)

              return {
                personId: `p${at + 3}`,
                name: NOBODY[at + 2]?.name ?? 'Somebody else',
                billedPaisa: outstanding + paid,
                paidPaisa: paid,
                outstandingPaisa: outstanding,
                onHouses: [
                  {
                    siteId: 's1',
                    name: THE_HOUSE,
                    billedPaisa: outstanding + paid,
                    paidPaisa: paid,
                    outstandingPaisa: outstanding,
                  },
                ],
              }
            }),
          }}
        />
      )
    },
  },
  {
    slug: 'money-in',
    at: '/money-in',
    name: 'Receipts',
    where: 'the nav, under the money it is the other half of',
    proves: 'Money arriving',
    // Two houses, because the whole reason this screen exists is that a house's own screen cannot answer what has come in altogether. One house here would photograph as a longer version of a screen the app already has.
    draw: () => {
      const arriving = [
        {
          day: '2026-07-23',
          rupees: 4_500_000,
          from: 0,
          house: 0,
          why: 'clientPayment' as const,
          how: 'cheque' as const,
          reference: 'CH-4471',
        },
        {
          day: '2026-07-11',
          rupees: 2_000_000,
          from: 1,
          house: 1,
          why: 'partnerMoney' as const,
          how: 'transfer' as const,
        },
        {
          day: '2026-06-28',
          rupees: 1_250_000,
          from: 0,
          house: 0,
          why: 'clientPayment' as const,
          how: 'payOrder' as const,
          reference: 'PO-2288',
        },
        { day: '2026-06-02', rupees: 900_000, from: 1, house: 1, why: 'partnerMoney' as const, how: 'cash' as const },
      ]

      const byWhy = {
        partnerMoney: paisa(arriving.reduce((sum, one) => (one.why === 'partnerMoney' ? sum + one.rupees : sum), 0)),
        clientPayment: paisa(arriving.reduce((sum, one) => (one.why === 'clientPayment' ? sum + one.rupees : sum), 0)),
        // Nothing sold yet, which is the state a reason with nothing under it has to photograph in: a zero rather than a gap.
        sale: 0,
      }

      return (
        <EverythingThatCameIn
          everything={{
            byWhy,
            receivedPaisa: byWhy.partnerMoney + byWhy.clientPayment + byWhy.sale,
            receipts: arriving.map((one, at) => ({
              _id: `r${at + 1}`,
              day: one.day,
              amountPaisa: paisa(one.rupees),
              why: one.why,
              method: one.how,
              reference: one.reference,
              siteId: one.house === 0 ? 's1' : 's2',
              siteName: one.house === 0 ? THE_HOUSE : '204-C, Phase 6',
              fromName: NOBODY[one.from]?.name ?? 'Somebody else',
            })),
          }}
        />
      )
    },
  },
  {
    slug: 'reports',
    at: '/reports',
    name: 'Reports',
    where: 'the nav, under the money',
    proves: 'The questions the books get asked',
    // Every figure here is one a screen behind a card also shows, so each is a different number: a card reading the wrong field looks exactly like a working card when two of them happen to match.
    draw: () => {
      // Built once and read three times, not built three times. Each call is its own set of figures, so a nudge under `nothingMeansTwoThings` would move one of them and leave the other two alone -- which is the shape of the defect that check looks for, manufactured by the fixture rather than found in the app.
      const dashboard = everythingAtOnce()

      return (
        <Reports
          what={{
            // Read from the Dashboard's own fixture rather than written again. These two are the same money on two screens, and it had `6,540,000` of its own -- the same figure, stale in the same way, and two screens hand-writing one number is exactly how they come to disagree while both look right.
            spending: {
              trades: 7,
              goneOutPaisa: dashboard.goneOutPaisa,
              ownMoneyPaisa: dashboard.comeIn.ownMoneyPaisa,
            },
            owed: { people: 3, payablePaisa: dashboard.owed.payablePaisa },
          }}
        />
      )
    },
  },
  {
    slug: 'people',
    at: '/people',
    name: 'People',
    where: 'the third place in the nav',
    proves: 'People',
    draw: () => (
      <People
        people={NOBODY.map((person) => ({ _id: person._id, name: person.name }))}
        onAdd={nothing}
        onEdit={nothing}
        onHide={nothing}
      />
    ),
  },
  {
    slug: 'their-account',
    at: '/people/$personId',
    name: 'Their account',
    where: 'People, then one of them',
    // The screen is titled with the person's own name once it has one, so this is what says it drew rather than the words above an empty one.
    proves: 'The tile shop',
    // Two figures are chosen here and everything else is worked out from them, which is what the app does with the same numbers. Written out four times over, a running balance and a total are four figures that agree by hand -- and `nothingMeansTwoThings` reads that as three ideas rendering one string, because that is exactly what it is.
    draw: () => {
      const billed = paisa(883_701)
      const paid = paisa(120_000)

      return (
        <TheirAccount
          answer={{
            account: {
              name: NOBODY[3].name,
              lines: [
                {
                  what: 'billed',
                  day: '2026-05-30',
                  amountPaisa: billed,
                  id: 'l1',
                  balancePaisa: billed,
                  onWhichHouse: THE_HOUSE,
                  said: 'Tiles for the first floor',
                },
                {
                  what: 'paid',
                  day: A_DAY,
                  amountPaisa: paid,
                  id: 'l2',
                  balancePaisa: billed - paid,
                  onWhichHouse: THE_HOUSE,
                },
              ],
              billedPaisa: billed,
              paidPaisa: paid,
            },
          }}
        />
      )
    },
  },
  {
    slug: 'more',
    at: '/more',
    name: 'Settings',
    where: 'the last place in the nav',
    proves: 'The list a day sheet picks from',
    // One of the trades is not a building cost, because the sentence under them only appears where one is -- and a card photographed without it is a picture of the easy half.
    draw: () => (
      <TheSettings
        what={{
          trades: TRADES,
          accounts: BANK,
          looksLike: 'Auto',
        }}
      />
    ),
  },
  {
    slug: 'what-for',
    at: '/more/what-for',
    name: 'What money is spent on',
    where: 'More, then what money is spent on',
    proves: 'Categories',
    draw: () => <Trades trades={TRADES} onAdd={nothing} onEdit={nothing} onTakeOff={nothing} />,
  },
  {
    slug: 'which-account',
    at: '/more/which-account',
    name: 'Account',
    where: 'More, then which account',
    // The heading it used to prove itself by was an `<h2>` this screen wrote instead of rendering a `Page`. It has a real title now, so the words that are its alone are the promise underneath it.
    proves: 'Only the last four figures are ever kept',
    draw: () => <BankAccounts accounts={BANK} onAdd={nothing} onTakeOff={nothing} />,
  },
  {
    slug: 'who-can-sign-in',
    at: '/more/who-can-sign-in',
    name: 'Who can sign in',
    where: 'More, then who can sign in',
    proves: 'Who can sign in',
    draw: () => (
      <WhoCanSignIn
        waiting={[
          { id: 'i1', email: 'somebody@example.com', askedOn: Date.parse('2026-07-01T09:00:00Z') },
          { id: 'i2', email: 'somebody.else@example.com', askedOn: Date.parse('2026-06-24T09:00:00Z') },
        ]}
        onInvite={nothing}
        onTakeOff={nothing}
      />
    ),
  },
  {
    slug: 'the-nav',
    at: '/dashboard',
    name: 'The nav',
    where: 'down the side from 768 up, and across the top of a phone',
    // Not the wordmark. It is in the rail, the rail is hidden below 768, and a picture at 390 then waits fifteen seconds for a word that is deliberately not on it. A destination is in both shapes, which is the property that makes it the right thing to wait for.
    proves: 'Dashboard',
    // Drawn at `/dashboard` so one row is the row you are on: an active row is a different height in some navs and the same in this one, which is worth being able to see rather than assume.

    // The rail on its own, drawn at every width rather than hidden below 768, because a component that carries its own breakpoint cannot be photographed at the width it hides at.
    draw: () => (
      <div className="flex min-h-dvh">
        {/* Clerk's `UserButton` in the app, and this in the gallery, because nothing here may reach a deployment. It is a stand-in for the control and not the control: what the sweep measures here is the room the nav keeps for it. */}
        <TheNav
          footer={
            <span
              aria-label="Where the sign-out avatar goes"
              className="bg-muted block size-11 rounded-full md:size-8"
            />
          }
        />
      </div>
    ),
  },
  {
    slug: 'the-nav-opened',
    at: '/dashboard',
    // The sheet is a portal on `body`, outside the element the gallery draws screens into.
    shownIn: '[data-slot="sheet-content"]',
    name: 'The nav, opened on a phone',
    where: 'the corner of every screen below 768',
    proves: 'Ledgers',
    // Opened, because a sheet that starts closed photographs an empty page and reports a clean nothing -- which is exactly how this nav went 889 tests, 17 screens and four measurements without one instrument ever drawing it, until he found 32px rows with his thumb.

    // The closed state is not a second entry. It is one 44px button with an icon in it and no words, so there is nothing it could prove -- and the button is still in the document once the sheet is open, which is where `columns` measures it.
    tapFirst: ['Sections'],
    draw: () => (
      <div className="p-3">
        <TheNavOnAPhone />
      </div>
    ),
  },
  {
    slug: 'the-shell',
    at: '/dashboard',
    name: 'The shell, whole',
    where: 'every screen, at every width',
    // Not `Construction`, which this shell says twice -- once in the rail and once in the header -- and each of them is hidden at the width the other is shown at. Playwright takes the first match and waits for it to be visible, so a marker on either one waits forever at one width or the other. The same trap the rail fell into an hour after it was drawn.
    proves: 'Whatever screen you are on sits here.',
    // The one thing on every screen and nothing had ever drawn it. `Shell` held Clerk's own control, Clerk will not render outside its own provider, and the gallery must hold nothing that could reach a deployment -- so the header was never photographed at any width, and the rail and the sheet were only ever drawn on their own, out of the row they really sit in.

    // Three props were what it took, each made one at a time as the thing behind it turned out to matter: the rail's footer when its rows were 32px, the search when it started reading the ledger, and the account last, which was the one still holding the door shut.
    draw: () => <TheShellAsDrawn />,
  },
  {
    slug: 'finding-anything',
    at: '/dashboard',
    // A dialog is a portal on `body`, the same as the sheet and for the same reason: what the gallery draws into is not where this lands.
    shownIn: '[data-slot="dialog-content"]',
    name: 'Finding a house or a person',
    where: 'the header of every screen',
    proves: 'Houses',
    // Opened, because a dialog that starts closed photographs an empty page and reports a clean nothing. The nav went 889 tests and 17 screens that way, and this is the same shape: a control on the header and everything worth looking at behind it.
    tapFirst: ['Search for a house or a person'],
    // Drawn with the names already read. The screen it is really in reads them only once somebody opens it, and there is a second picture in that -- the one where nothing has arrived -- which is what `Finding.test` holds rather than a photograph, because a wait has no fixed moment to point a camera at.
    draw: () => <TheSearchAsDrawn />,
  },
  {
    slug: 'agree-a-contract',
    at: '/sites/$siteId',
    name: 'What the client is paying',
    where: 'a house built for a client, before a contract is agreed',
    partOf: 'the house screen',
    proves: 'Client',
    // Drawn by `Billing`, which reads Convex itself, so nothing had ever photographed this: two changes went through it without a picture being taken of either.
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <AgreeAContract people={NOBODY.map((person) => ({ _id: person._id, name: person.name }))} onAgree={nothing} />
      </Page>
    ),
  },
  {
    slug: 'change-the-contract',
    at: '/sites/$siteId',
    tapFirst: ['Change it'],
    name: 'Correcting what was agreed',
    where: 'a house with a contract, down the screen',
    partOf: 'the house screen',
    // What it proves has to be true of the state it is photographed in. `Change it` is the button that opens this, and tapping it is the first thing the harness does -- so the marker was gone by the time anything looked for it, and the check that now asks whether the proof is in the picture is what said so.
    proves: 'Save measurement',
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <ChangeTheContract
          contract={{ priced: { how: 'ratePerSqft', ratePerSqftPaisa: paisa(2_400) }, agreedAreaSqft: 5_000 }}
          onMeasure={nothing}
          onRevise={nothing}
          onCancel={nothing}
        />
      </Page>
    ),
  },
  {
    slug: 'who-is-on-this-house',
    at: '/sites/$siteId',
    name: 'People',
    where: 'a house, down the screen',
    partOf: 'the house screen',
    proves: 'People on this house',
    // Paid in full is `paid == billed`, so it is written as one figure used twice rather than as two that happen to agree. Typed separately they are two ideas rendering one string, and an assertion about what the tile shop was billed matches what it was paid.
    draw: () => {
      const billedToTheTileShop = paisa(742_000)

      return (
        <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
          <WhoIsOnThisHouse
            engaged={[
              {
                engagementId: 'e1',
                personName: 'The mason',
                tradeName: 'Civil labour',
                agreedPaisa: paisa(1_300_000),
                ratePaisa: undefined,
                unit: undefined,
                billedPaisa: paisa(1_465_000),
                paidPaisa: paisa(1_100_000),
              },
              {
                engagementId: 'e2',
                personName: 'The tile shop',
                tradeName: 'Tiles',
                agreedPaisa: undefined,
                ratePaisa: paisa(310),
                unit: 'sq ft',
                billedPaisa: billedToTheTileShop,
                paidPaisa: billedToTheTileShop,
              },
            ]}
            claimed={[
              {
                _id: 'b1',
                personName: 'The mason',
                tradeName: 'Civil labour',
                day: '2026-06-27',
                amountPaisa: paisa(165_000),
                reference: 'CH-114',
              },
            ]}
            people={NOBODY.map((person) => ({ _id: person._id, name: person.name }))}
            trades={TRADES.map((trade) => ({ _id: trade._id, name: trade.name }))}
            saving={false}
            refusal={null}
            takingOut={null}
            onAgree={nothingTrue}
            onRaise={nothingTrue}
            onTakeOut={nothingTrue}
            onAddTrade={() => Promise.resolve('t9')}
          />
        </Page>
      )
    },
  },
  {
    slug: 'what-each-partner-is-owed',
    at: '/sites/$siteId',
    name: 'Owed to partners',
    where: 'a house, down the screen',
    partOf: 'the house screen',
    proves: 'Owed to partners',
    // A partner who has had everything shows `due` and `paid` as one figure, because that is what a zero balance is. One call used twice rather than two that agree by hand: the equality is the point, and it should survive somebody changing what he is owed.
    draw: () => {
      const dueToTheOneWhoCameLater = paisa(1_750_000)

      return (
        <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
          <Positions
            what={{
              positions: [
                {
                  personId: 'p1',
                  name: 'The one who started it',
                  capitalPaisa: paisa(7_400_000),
                  basisPoints: 6_000,
                  duePaisa: paisa(2_625_000),
                  paidPaisa: paisa(1_000_000),
                  balancePaisa: paisa(1_625_000),
                },
                {
                  personId: 'p2',
                  name: 'The one who came in later',
                  capitalPaisa: paisa(4_930_000),
                  basisPoints: 4_000,
                  duePaisa: dueToTheOneWhoCameLater,
                  paidPaisa: dueToTheOneWhoCameLater,
                  balancePaisa: 0,
                },
              ],
              broughtInPaisa: paisa(12_330_000),
              spentPaisa: paisa(8_955_000),
              profitPaisa: paisa(4_375_000),
              sold: true,
              sharesAgreed: true,
              ifItSoldToday: null,
            }}
          />
        </Page>
      )
    },
  },
  {
    slug: 'start-a-house',
    at: '/sites/new',
    name: 'Add a site',
    where: 'the houses, then start one',
    proves: 'Covered area',
    draw: () => (
      <Page title="Add a site">
        <HouseDetails saying="Start it" onSave={nothing} />
      </Page>
    ),
  },
  {
    slug: 'a-send-that-has-not-come-back',
    at: '/sites/$siteId/day',
    // The sentence itself, because it is the whole of what this screen is here to show. `shots` waits for what a screen proves, so the wait for it is the wait that was already there.
    proves: 'This has not gone in yet',
    provesAfter: 8_000,
    name: 'A send with no signal',
    where: 'any screen, the moment the phone loses signal mid-send',
    // Drawn on the day sheet rather than on money coming in, and the reason is the picture rather than the state. Both screens hold the same sentence; on money coming in it sits at the foot of a form longer than a phone, so the photograph framed a form that could have been any screen while the thing it is named for sat 300px below the picture. The day sheet's bar is sticky, so what he sees is what this shows.
    draw: () => (
      <DaySheet
        siteName={THE_HOUSE}
        day={A_DAY}
        onChangeDay={() => undefined}
        trades={TRADES.map((trade) => ({ _id: trade._id as never, name: trade.name }))}
        people={NOBODY.map((person) => ({ _id: person._id as never, name: person.name }))}
        accounts={BANK.map((account) => ({ _id: account._id as never, label: account.label }))}
        saving
        refusal={null}
        onPutIn={nothingTrue}
        onAddAccount={() => Promise.resolve('b1' as never)}
        onAddTrade={() => Promise.resolve('t1' as never)}
      />
    ),
  },
  {
    slug: 'sure-you-want-to',
    at: '/sites/$siteId',
    name: 'Being asked if you are sure',
    where: 'a house with a contract, two taps into changing it',
    partOf: 'the house screen',
    proves: 'Yes, cancel it',
    // Two taps in, which is where every destructive control in this app lives and where nothing had ever photographed one. Every screen was drawn at rest, so the are-you-sure was never on the page while anything measured -- and the more destructive half of the controls is the half behind it.
    tapFirst: ['Change it', 'Cancel this contract'],
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <ChangeTheContract
          contract={{ priced: { how: 'ratePerSqft', ratePerSqftPaisa: paisa(2_400) }, agreedAreaSqft: 5_000 }}
          onMeasure={nothing}
          onRevise={nothing}
          onCancel={nothing}
        />
      </Page>
    ),
  },
  {
    slug: 'a-reading-that-has-not-arrived',
    at: '/owed',
    name: 'A reading with no signal',
    where: 'any screen still waiting for what it reads',
    proves: 'This has not come through yet',
    provesAfter: 12_000,
    // `undefined` is a reading still on its way, which is what a phone with no signal leaves every screen holding. The bars keep the shape of what is coming and the sentence sits under them.
    draw: () => <WhatWeOwe owed={undefined} />,
  },
  {
    slug: 'how-it-looks',
    at: '/more/how-it-looks',
    name: 'Appearance',
    where: 'More, then how it looks',
    proves: 'Appearance',
    draw: () => <HowItLooks />,
  },
  {
    slug: 'taking-a-payment-back-out',
    at: '/sites/$siteId',
    name: 'Taking a payment back out',
    where: 'a house, a trade opened, then the way out on a payment',
    partOf: 'the house screen',
    proves: 'Yes, remove',
    // The same are-you-sure `WhoIsOnThisHouse` draws on a bill, word for word, so a picture of this row is a picture of that one. The label carries the figure and the name -- `Take out ₨26,50,000 paid to …` -- which is why what is tapped is part of a name rather than all of it.
    tapFirst: ['Remove'],
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <SpentByTrade
          byTrade={[{ tradeId: 't1', name: 'Civil labour', paisa: paisa(4_318_000) }]}
          onOpen={() => undefined}
          opened={{
            tradeId: 't1',
            went: [
              {
                _id: 'w1',
                day: A_DAY,
                amountPaisa: paisa(2_650_000),
                paidToName: NOBODY[2].name,
                method: 'cheque',
                reference: '774312',
              },
            ],
          }}
          onTakeOut={nothingTrue}
          takingOut={null}
          refusal={null}
        />
      </Page>
    ),
  },
  {
    slug: 'putting-a-house-away',
    at: '/sites/$siteId',
    name: 'Putting a house away',
    where: 'a house, then changing it, at the foot of the form',
    partOf: 'the house screen',
    proves: 'Yes, archive',
    // Two taps in and at the bottom of a form longer than a phone, which is the whole reason it is photographed rather than reasoned about: the sentence above it says what is kept, and a picture is the only thing that says whether he can read it without scrolling.
    tapFirst: ['Edit house', 'Archive'],
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <ChangeTheHouse
          house={{ name: THE_HOUSE, coveredAreaSqft: '5,000', stage: 'building', builtForAClient: true }}
          onSave={nothing}
          onPutAway={nothing}
        />
      </Page>
    ),
  },
]
