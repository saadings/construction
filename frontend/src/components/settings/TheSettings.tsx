import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Page } from '../shell/Page'
import { Heading, Panel, Pill } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

// More was four unrelated things in one scroll: who may sign in, how it looks, the list a day sheet picks from, and the accounts money leaves. Each with its own form, stacked, and none of them named after anything on a screen he uses.

// So it became a menu, and every place behind it is named after the question it answers on a form -- he was looking at the day sheet's `WHAT FOR` and could not find the list it picks from, because the list was called "what money is spent on".

// The names stay and the shape does not. A menu of four rows is four lines of text on a screen twice as wide as they are, which is the complaint that started the redesign in a different form: he asked one question of it and had to open four screens to answer it. The drawing puts each list **on** this screen, in a card, with a way through to the screen that changes it.
export type WhatIsOnIt = {
  /** The trade list a day sheet picks from. Still coming, refused, or here. */
  trades: Array<{ _id: string; name: string; countsAsBuildingCost: boolean }> | null | undefined
  /** The accounts a cheque or transfer says it left. */
  accounts: Array<{ _id: string; label: string }> | null | undefined
  /** Everybody the ledger names, for the count on the card. */
  people: Array<{ _id: string }> | null | undefined
  /** What the app is set to look like, which is known without reading anything. */
  looksLike: string
}

/** How many of the drawn pills are shown before the rest are counted rather than named. Enough that a short list is the whole list, and few enough that a long one does not turn a card into a page. */
const NAMED_BEFORE_COUNTING = 10

export function TheSettings({ what }: { what: WhatIsOnIt }) {
  return (
    <Page
      title="Settings"
      said="The lists the rest of the app picks from. Change them here once and every screen follows."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          name="Categories"
          what="The list a day sheet picks from — bricks, steel, plot, and anything you add."
          count={what.trades === undefined || what.trades === null ? undefined : what.trades.length}
          to="/more/what-for"
        >
          <Trades trades={what.trades} />
        </Section>

        {/* `Bank accounts`, as drawn. It was `Account`, singular, over a card listing several of them -- a heading disagreeing with its own contents about how many there are. */}
        <Section
          name="Bank accounts"
          what="The accounts a cheque or transfer says it left. Only the last four figures are kept."
          count={what.accounts === undefined || what.accounts === null ? undefined : what.accounts.length}
          to="/more/which-account"
        >
          <Accounts accounts={what.accounts} />
        </Section>

        {/* Drawn here and missing, and it belongs: this screen is the lists the rest of the app picks from, and People is one of them -- it is what a day sheet, a bill and a receipt all pick a name out of. */}

        {/* The drawing puts `Add` beside `Open`. Nothing can open the People screen with its form already up, so there is one way through rather than two buttons to the same place. */}
        <Section
          name="People"
          what="Everybody the ledger names. Nobody is ever deleted — hiding one keeps whatever he was part of."
          count={what.people === undefined || what.people === null ? undefined : what.people.length}
          to="/people"
        />

        <Section
          name="Who can sign in"
          what="Invite somebody. Nobody can sign in without one, and signing up is closed."
          to="/more/who-can-sign-in"
        />

        {/* Not in the drawing at all, and it stays: dark mode is something Nauman asked for by name, and a settings screen that cannot reach it would be the redesign quietly removing a feature. */}
        <Section name="Appearance" what="Light, dark, or whatever the phone is doing." to="/more/how-it-looks">
          <p className="text-muted-foreground text-sm">
            Set to <span className="text-foreground">{what.looksLike}</span>.
          </p>
        </Section>
      </div>
    </Page>
  )
}

// One card, with the way through in the corner where the drawing puts it. The whole card is not the link: what is inside it is a list somebody reads, and a card that navigates on any click is a card you cannot read without leaving.
function Section({
  name,
  what,
  count,
  to,
  children,
}: {
  name: string
  what: string
  count?: number
  to: string
  children?: ReactNode
}) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <Heading
        said={name}
        count={count}
        beside={
          <Link
            to={to}
            // 44px tall rather than the drawn 31. The drawing is a picture and this is the control a thumb aims at on the one screen whose whole job is getting somewhere else -- and the box is bordered, so the `py-3 -my-3` trick a way out uses would grow what you can see rather than only what you can hit.
            className="border-input bg-card hover:border-brass inline-flex min-h-11 items-center rounded-md border px-4 text-[0.8125rem] font-medium shadow-xs transition-colors"
          >
            Open
          </Link>
        }
      />

      <p className="text-muted-foreground max-w-prose text-[0.8125rem]">{what}</p>

      {children}
    </Panel>
  )
}

function Trades({ trades }: { trades: WhatIsOnIt['trades'] }) {
  if (trades === undefined) {
    return (
      <WhileWaiting what="Getting the trades">
        <div className="flex flex-wrap gap-2">
          {['w-20', 'w-16', 'w-24', 'w-14', 'w-28'].map((width) => (
            <Skeleton key={width} className={`h-7 ${width} rounded-full`} />
          ))}
        </div>
      </WhileWaiting>
    )
  }

  // Refused, which the screen behind this card will say. Saying it twice, in a card whose whole content is a list somebody cannot have, is saying it in the wrong place.
  if (trades === null) {
    return null
  }

  if (trades.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing on the list yet. Open it and put the first one in.</p>
  }

  const building = trades.filter((trade) => trade.countsAsBuildingCost)
  const not = trades.filter((trade) => !trade.countsAsBuildingCost)

  return (
    <div className="flex flex-col gap-4">
      <Pills names={building.map((trade) => trade.name)} />

      {not.length === 0 ? null : (
        <div className="border-border flex flex-col gap-3 border-t pt-4">
          {/* The drawing's own sentence, kept because it is the reason the flag exists at all: supervision charges are real money and are not what the house cost to build. */}
          <p className="text-muted-foreground text-[0.8125rem]">
            {not.length === 1 ? 'This one is' : `These ${String(not.length)} are`} marked as{' '}
            <span className="text-foreground font-medium">not part of building cost</span>, so what a house cost stays
            honest.
          </p>
          <Pills names={not.map((trade) => trade.name)} quiet />
        </div>
      )}
    </div>
  )
}

// The tail counted rather than cut. A card that shows ten of thirty and says nothing says the list is ten long.
function Pills({ names, quiet = false }: { names: Array<string>; quiet?: boolean }) {
  const shown = names.slice(0, NAMED_BEFORE_COUNTING)
  const rest = names.length - shown.length

  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((name) => (
        <li key={name}>
          <Pill className={quiet ? 'border-border bg-card border' : undefined}>{name}</Pill>
        </li>
      ))}

      {rest < 1 ? null : (
        <li>
          <span className="text-faint text-[0.8125rem] leading-7">and {rest} more</span>
        </li>
      )}
    </ul>
  )
}

function Accounts({ accounts }: { accounts: WhatIsOnIt['accounts'] }) {
  if (accounts === undefined) {
    return (
      <WhileWaiting what="Getting the accounts">
        <div className="flex flex-col gap-3">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-4 w-32" />
          ))}
        </div>
      </WhileWaiting>
    )
  }

  if (accounts === null) {
    return null
  }

  if (accounts.length === 0) {
    return <p className="text-muted-foreground text-sm">No account yet. Open it and add the first one.</p>
  }

  return (
    <ul className="divide-border flex flex-col divide-y">
      {accounts.map((account) => (
        <li key={account._id} className="text-foreground py-2.5 text-sm first:pt-0 last:pb-0">
          {account.label}
        </li>
      ))}
    </ul>
  )
}
