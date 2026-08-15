import type { ReactNode } from 'react'

import { DaySheet } from '../components/daySheet/DaySheet'
import { WhoCanSignIn } from '../components/invites/WhoCanSignIn'
import { ComingIn } from '../components/moneyIn/ComingIn'
import { WhatWeOwe } from '../components/owed/WhatWeOwe'
import { AgreeShares } from '../components/partners/AgreeShares'
import { People } from '../components/people/People'
import { TheirAccount } from '../components/people/TheirAccount'
import { BankAccounts } from '../components/settings/BankAccounts'
import { HowItLooks } from '../components/settings/HowItLooks'
import { TheMenu } from '../components/settings/TheMenu'
import { Trades } from '../components/settings/Trades'
import { PayOut } from '../components/shares/PayOut'
import { SitesList } from '../components/sites/SitesList'
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
  /** Words this screen shows and no other does. A gallery that answered every address with the first screen would otherwise draw twelve pictures of one, and every one of them would look right. */
  proves: string
  draw: () => ReactNode
}

// Nothing here goes anywhere. The screens ask for callbacks and the gallery has no ledger behind it, so each one answers and does nothing -- which is why the page says out loud that it is scaffolding.
const nothing = () => Promise.resolve()
const nothingTrue = () => Promise.resolve(true)

export const ON_SHOW: Array<OnShow> = [
  {
    slug: 'sites',
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
    name: 'What went out today',
    where: 'a house, then the day sheet',
    proves: 'In this sitting',
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
      />
    ),
  },
  {
    slug: 'coming-in',
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
      />
    ),
  },
  {
    slug: 'shares',
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
            />
          )}
        />
      )
    },
  },
  {
    slug: 'owed',
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
    name: 'What money is spent on',
    where: 'More, then what money is spent on',
    proves: 'What for',
    draw: () => <Trades trades={TRADES} onAdd={nothing} onEdit={nothing} onTakeOff={nothing} />,
  },
  {
    slug: 'which-account',
    name: 'Which account',
    where: 'More, then which account',
    proves: 'Accounts money leaves',
    draw: () => <BankAccounts accounts={BANK} onAdd={nothing} onTakeOff={nothing} />,
  },
  {
    slug: 'who-can-sign-in',
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
    slug: 'how-it-looks',
    name: 'How it looks',
    where: 'More, then how it looks',
    proves: 'How it looks',
    draw: () => <HowItLooks />,
  },
]
