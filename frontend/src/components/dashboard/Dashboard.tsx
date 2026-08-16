import { Link } from '@tanstack/react-router'
import { formatPaisa } from '~shared/money'

import { Figure, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { Card } from '../ui/card'
import { Table, TableBody, TableCell, TableRow } from '../ui/table'
import { MoneyByMonth } from './MoneyByMonth'
import { WhereItWent } from './WhereItWent'

// Everything at once, across every house. Nauman's word for it, and the one place in this app using a software term rather than the words on his own screens.

// Every figure here is one the ledger already answers. Nothing is worked out for a tile, because a number nobody can go and find the rows behind is a number nobody can act on.
export type WhatIsHappening = {
  owed: { payablePaisa: number; advancedPaisa: number }
  goneOutPaisa: number
  comeIn: { receivedPaisa: number; ownMoneyPaisa: number }
  whereItWent: Array<{ tradeId: string | null; name: string; paisa: number }>
  whatCameIn: Array<{ month: string; ownMoneyPaisa: number; broughtInPaisa: number }>
  houses: Array<{ siteId: string; name: string; stage: string; goneOutPaisa: number; comeInPaisa: number }>
  nothingYet: boolean
}

const STAGE: Record<string, string> = {
  planning: 'Planning',
  building: 'Building',
  finishing: 'Finishing',
  complete: 'Finished',
  sold: 'Sold',
}

export function Dashboard({ what }: { what: WhatIsHappening | null | undefined }) {
  if (what === undefined) {
    return (
      <Page title="Dashboard">
        <Waiting />
      </Page>
    )
  }

  if (what === null) {
    return (
      <Page title="Dashboard">
        <p className="text-muted-foreground max-w-prose">
          This did not come back. Sign out and in again, and if it is still here after that, something is wrong at our
          end rather than yours.
        </p>
      </Page>
    )
  }

  return (
    <Page title="Dashboard">
      {/* Not a fallback. His first day is one house with nothing in it, and a dashboard drawing charts over four zeroes is what everybody ships. */}
      {what.nothingYet ? <NothingYet houses={what.houses.length} /> : <Everything what={what} />}
    </Page>
  )
}

function Everything({ what }: { what: WhatIsHappening }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Owed right now" paisa={what.owed.payablePaisa} tone="text-green">
          {/* Never netted into the figure above it. An advance held by the tile man is not money available to pay the steel man. */}
          {what.owed.advancedPaisa === 0
            ? 'Nobody is holding an advance.'
            : `${formatPaisa(what.owed.advancedPaisa)} is held in advance, which is not money to pay anybody with.`}
        </Tile>

        <Tile label="Gone out" paisa={what.goneOutPaisa} tone="text-brass">
          Across every house, everything not taken back out.
        </Tile>

        <Tile label="Come in" paisa={what.comeIn.receivedPaisa} tone="text-green">
          {/* The line I would not let a reviewer cut. Without it the biggest figure on the screen reads as profit. */}
          {what.comeIn.ownMoneyPaisa === 0
            ? 'None of it is your own money.'
            : `${formatPaisa(what.comeIn.ownMoneyPaisa)} of it is your own money.`}
        </Tile>
      </section>

      <WhereItWent spending={what.whereItWent} />
      <MoneyByMonth months={what.whatCameIn} />
      <Houses houses={what.houses} />
    </div>
  )
}

function Tile({ label, paisa, tone, children }: { label: string; paisa: number; tone: string; children: string }) {
  // shadcn's own card, which was vendored for this and had no user until now. Four of its defaults are undone: `gap-6` and `py-6` are the room a card with a header, a body and a footer needs and this has three lines, `rounded-xl` is rounder than anything else on these screens, and `shadow-sm` is a raised card in an app that has none.
  return (
    <Card className="border-border gap-1 rounded-md p-4 shadow-none">
      <p className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{label}</p>
      <Figure className={`${tone} text-[2rem] leading-none`}>{formatPaisa(paisa)}</Figure>
      <p className="text-muted-foreground text-sm">{children}</p>
    </Card>
  )
}

function Houses({ houses }: { houses: WhatIsHappening['houses'] }) {
  return (
    <section className="flex flex-col gap-3">
      <Heading>The houses</Heading>

      {houses.length === 0 ? (
        <p className="text-muted-foreground">No houses yet.</p>
      ) : (
        // The size is set back because shadcn's table is `text-sm`, and these rows are the reading rather than a note under it -- the same decision the other four tables took.

        // And no minimum width, because at 390 a 26rem table left `9,310,000` rendering as `9,3` under the edge of its own scroller. A name cut with an ellipsis reads as incomplete and somebody swipes; a figure cut in half reads as a different, smaller figure, and nothing on the screen says otherwise. So a phone gets fewer columns rather than narrower ones, and the money is what survives.
        <Table className="text-base">
          <TableBody>
            {houses.map((house) => (
              <TableRow key={house.siteId}>
                {/* A house is named by whoever started it and can run long, so it wraps rather than pushing its figures off the side. */}
                <TableCell className="py-2.5 pr-4 whitespace-normal">
                  <Link to="/sites/$siteId" params={{ siteId: house.siteId }} className="text-foreground">
                    {house.name}
                  </Link>
                </TableCell>
                {/* The column a phone gives up. Where a house has got to is a word somebody can get from the house itself; the two figures beside it are not. */}
                <TableCell className="text-muted-foreground hidden py-2.5 pr-4 text-sm sm:table-cell">
                  {STAGE[house.stage] ?? house.stage}
                </TableCell>
                <TableCell className="py-2.5 pr-4 text-right">
                  <Figure className="text-brass">{formatPaisa(house.goneOutPaisa)}</Figure>
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  <Figure className="text-green">{formatPaisa(house.comeInPaisa)}</Figure>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

// The screen he sees first and today, built as its own thing rather than as an empty version of the other one.
function NothingYet({ houses }: { houses: number }) {
  return (
    <div className="flex flex-col gap-4 py-6">
      <p className="text-foreground font-display text-2xl">Nothing has gone in yet.</p>
      <p className="text-muted-foreground max-w-prose">
        {houses === 0
          ? 'Start a house, and what it costs and what comes in against it collect here.'
          : `${houses === 1 ? 'One house is' : `${houses} houses are`} down and nothing has been entered against ${houses === 1 ? 'it' : 'them'} yet. Put in a day of payments, or the money that has come in, and this fills itself.`}
      </p>

      <div className="flex flex-wrap gap-3">
        <Link to="/" className="bg-primary text-primary-foreground rounded-md px-5 py-3 font-medium">
          {houses === 0 ? 'Start a house' : 'Go to the houses'}
        </Link>
        <Link to="/people" className="border-border text-foreground rounded-md border px-5 py-3 font-medium">
          Put the people in
        </Link>
      </div>
    </div>
  )
}

function Waiting() {
  return (
    <WhileWaiting what="Getting everything">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((tile) => (
          <div key={tile} className="border-border bg-card flex flex-col gap-2 rounded-md border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-40 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <Skeleton className="mt-4 h-3 w-28" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((bar) => (
          <div key={bar} className="flex items-center gap-3">
            <Skeleton className="h-4 w-28 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{children}</h2>
}

export { Heading }
