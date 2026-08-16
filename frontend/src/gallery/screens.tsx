import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { Dashboard } from '../components/dashboard/Dashboard'
import { DaySheet } from '../components/daySheet/DaySheet'
import { WhoCanSignIn } from '../components/invites/WhoCanSignIn'
import { ComingIn } from '../components/moneyIn/ComingIn'
import { WhatHasComeIn } from '../components/moneyIn/WhatHasComeIn'
import { WhatWeOwe } from '../components/owed/WhatWeOwe'
import { AgreeShares } from '../components/partners/AgreeShares'
import { People } from '../components/people/People'
import { TheirAccount } from '../components/people/TheirAccount'
import { BankAccounts } from '../components/settings/BankAccounts'
import { HowItLooks } from '../components/settings/HowItLooks'
import { TheMenu } from '../components/settings/TheMenu'
import { Trades } from '../components/settings/Trades'
import { PayOut } from '../components/shares/PayOut'
import { Page } from '../components/shell/Page'
import { TheNav, TheWayIntoTheNav } from '../components/shell/TheNav'
import { ExtraWork } from '../components/site/ExtraWork'
import { SpentByTrade } from '../components/site/SpentByTrade'
import { Stages } from '../components/site/Stages'
import { SitesList } from '../components/sites/SitesList'
import { SidebarProvider, useSidebar } from '../components/ui/sidebar'
import { A_DAY, BANK, NOBODY, STILL_OWED, THE_HOUSE, TRADES, paisa } from './fixtures'

// Every screen a route draws whole, with invented figures, so somebody can look at one without signing in.

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
  /** Where this screen's markup ends up, when it is not inside the element the gallery draws screens into. Below 768 the nav is a sheet, and Radix puts a sheet in a portal on `body` -- outside `[data-testid="the-screen"]` entirely. Nothing was wrong with the marker or the timing: the camera was looking inside an element the screen had left. */
  shownIn?: string
  /** Words this screen shows and no other does. A gallery that answered every address with the first screen would otherwise draw twelve pictures of one, and every one of them would look right. */
  proves: string
  draw: () => ReactNode
}

// Nothing here goes anywhere. The screens ask for callbacks and the gallery has no ledger behind it, so each one answers and does nothing -- which is why the page says out loud that it is scaffolding.
const nothing = () => Promise.resolve()
const nothingTrue = () => Promise.resolve(true)

// The sheet, held open. Below 768 the nav is a sheet that starts closed, so a gallery that just drew it would photograph and measure an empty page -- and report a clean nothing about the only navigation a phone has. Opened here because that is the state somebody is in the moment they are trying to hit a row.
function AsAThumbFindsIt() {
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) setOpenMobile(true)
  }, [isMobile, setOpenMobile])

  return null
}

export const ON_SHOW: Array<OnShow> = [
  {
    slug: 'dashboard',
    at: '/dashboard',
    name: 'Dashboard',
    where: 'the first row of the nav',
    proves: 'Owed right now',
    // Every figure below is a different number on purpose. Two that happen to match make a wiring bug look like a working screen -- a tile reading the wrong field, a house's column drawn from the total -- and this has been caught twice already in fixtures that were not this careful.
    draw: () => (
      <Dashboard
        what={{
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
            { month: '2026-04', ownMoneyPaisa: paisa(2_100_000), broughtInPaisa: paisa(0) },
            { month: '2026-05', ownMoneyPaisa: paisa(1_240_000), broughtInPaisa: paisa(4_800_000) },
            { month: '2026-06', ownMoneyPaisa: paisa(3_200_000), broughtInPaisa: paisa(6_150_000) },
            { month: '2026-07', ownMoneyPaisa: paisa(0), broughtInPaisa: paisa(4_660_000) },
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
            { siteId: 's3', name: '12-B, Phase 3', stage: 'planning', goneOutPaisa: 0, comeInPaisa: 0 },
          ],
          nothingYet: false,
        }}
      />
    ),
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
              billedOn: '2026-04-11',
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
    name: 'Work outside the contract',
    where: 'a house built for a client, down the screen',
    partOf: 'the house screen',
    proves: 'Work outside the contract',
    draw: () => (
      <Page title={THE_HOUSE} named={{ siteId: THE_HOUSE }}>
        <ExtraWork
          bills={[
            {
              _id: 'b1',
              raisedOn: '2026-06-02',
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
          { _id: 's1', name: THE_HOUSE, stage: 'building', builtForAClient: false, spentPaisa: paisa(11_798_452) },
          { _id: 's2', name: '204-C, Phase 6', stage: 'sold', builtForAClient: true, spentPaisa: paisa(8_140_000) },
          { _id: 's3', name: '12-B, Phase 3', stage: 'planning', builtForAClient: false, spentPaisa: 0 },
        ]}
      />
    ),
  },
  {
    slug: 'day-sheet',
    at: '/sites/$siteId/day',
    name: 'What went out today',
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
        onPutIn={() => undefined}
        onAddAccount={() => Promise.resolve('b1' as never)}
        onAddTrade={() => Promise.resolve('t1' as never)}
      />
    ),
  },
  {
    slug: 'coming-in',
    at: '/sites/$siteId/coming-in',
    name: 'Money coming in',
    where: 'a house, then money coming in',
    proves: 'Money coming in',
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
    name: 'What each partner takes',
    where: 'a house, then what each partner takes',
    proves: 'Money gone back to them',
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
    name: 'Owed',
    where: 'the second place in the nav',
    proves: 'Owed',
    draw: () => (
      <WhatWeOwe
        owed={{
          payablePaisa: paisa(1_591_701),
          advancedPaisa: paisa(58_000),
          everyone: STILL_OWED.map((row, at) => ({
            personId: `p${at + 3}`,
            name: NOBODY[at + 2]?.name ?? 'Somebody else',
            billedPaisa: paisa(row.rupees + 120_000),
            paidPaisa: paisa(120_000),
            outstandingPaisa: paisa(row.rupees),
            onHouses: [
              {
                siteId: 's1',
                name: THE_HOUSE,
                billedPaisa: paisa(row.rupees + 120_000),
                paidPaisa: paisa(120_000),
                outstandingPaisa: paisa(row.rupees),
              },
            ],
          })),
        }}
      />
    ),
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
    draw: () => (
      <TheirAccount
        answer={{
          account: {
            name: NOBODY[3].name,
            lines: [
              {
                what: 'billed',
                day: '2026-05-30',
                amountPaisa: paisa(883_701),
                id: 'l1',
                balancePaisa: paisa(883_701),
                onWhichHouse: THE_HOUSE,
                said: 'Tiles for the first floor',
              },
              {
                what: 'paid',
                day: A_DAY,
                amountPaisa: paisa(120_000),
                id: 'l2',
                balancePaisa: paisa(763_701),
                onWhichHouse: THE_HOUSE,
              },
            ],
            billedPaisa: paisa(883_701),
            paidPaisa: paisa(120_000),
          },
        }}
      />
    ),
  },
  {
    slug: 'more',
    at: '/more',
    name: 'More',
    where: 'the last place in the nav',
    proves: 'What money is spent on',
    draw: () => (
      <TheMenu
        places={[
          {
            to: '/more/what-for',
            name: 'What money is spent on',
            what: 'The list every payment is put under.',
            now: `${String(TRADES.length)} of them`,
          },
          {
            to: '/more/which-account',
            name: 'Which account',
            what: 'The accounts cheques and transfers leave.',
            now: `${String(BANK.length)} of them`,
          },
          { to: '/more/who-can-sign-in', name: 'Who can sign in', what: 'Who may open the ledger.', now: '2 waiting' },
          { to: '/more/how-it-looks', name: 'How it looks', what: 'Light or dark, or follow the phone.', now: 'Auto' },
        ]}
      />
    ),
  },
  {
    slug: 'what-for',
    at: '/more/what-for',
    name: 'What money is spent on',
    where: 'More, then what money is spent on',
    proves: 'What for',
    draw: () => <Trades trades={TRADES} onAdd={nothing} onEdit={nothing} onTakeOff={nothing} />,
  },
  {
    slug: 'which-account',
    at: '/more/which-account',
    name: 'Which account',
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
    // The sheet is a portal on `body` below 768 and an ordinary child above it, so the one selector that holds at every width is the nav itself.
    shownIn: '[data-slot="sidebar"]',
    name: 'The nav',
    where: 'behind the hamburger on a phone, down the side from 768 up',
    proves: 'Construction',
    // Drawn at `/dashboard` so one row is the row you are on: an active row is a different height in some navs and the same in this one, which is worth being able to see rather than assume.
    draw: () => (
      <SidebarProvider>
        <AsAThumbFindsIt />

        {/* Where `Shell` puts it: in a bar that is gone from 768 up, which is why this is hidden there too rather than sitting over the column. */}
        <div className="p-3 md:hidden">
          <TheWayIntoTheNav />
        </div>

        {/* Clerk's `UserButton` in the app, and this in the gallery, because nothing here may reach a deployment. It is a stand-in for the control and not the control: what the sweep measures here is the room the nav keeps for it. */}
        <TheNav
          footer={
            <span
              aria-label="Where the sign-out avatar goes"
              className="bg-muted block size-11 rounded-full md:size-8"
            />
          }
        />
      </SidebarProvider>
    ),
  },
  {
    slug: 'how-it-looks',
    at: '/more/how-it-looks',
    name: 'How it looks',
    where: 'More, then how it looks',
    proves: 'How it looks',
    draw: () => <HowItLooks />,
  },
]
