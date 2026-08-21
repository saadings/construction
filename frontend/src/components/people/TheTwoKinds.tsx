import { Link } from '@tanstack/react-router'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Heading, Panel, Pill, TablePanel } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type WeOwe = {
  personId: string
  name: string
  phone?: string
  /** What they do on a house, or what they are to it: his own column is `Trade or role`, which is one question with two answers. */
  doing?: string
  billedPaisa: number
  paidPaisa: number
  outstandingPaisa: number
}

export type PutsMoneyIn = {
  personId: string
  name: string
  phone?: string
  role?: 'partner' | 'investor' | 'client'
  inPaisa: number
}

export type TheTwoSides = {
  weOwe: Array<WeOwe>
  putIn: Array<PutsMoneyIn>
  owedPaisa: number
  inPaisa: number
}

// The two kinds his drawing splits People into, and they are not the same ledger: money goes **out** to the trade, and comes **in** from partners and clients. The same man can be on both -- on his own house he is partner and client at once -- so these are two readings of everybody rather than a division of them.

// Two shapes on purpose, and that is the part a flat list of names was not a worse version of: it was neither. A balance is read down a column against other balances, and what somebody has put in is read as a thing of its own.

/** Somebody's initials, which is what his drawing puts in front of every name. */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /[A-Za-z]/.test(word))

  if (words.length === 0) return '—'

  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''

  return `${first}${last}`.toUpperCase()
}

const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]'
const ROW = 'col-span-full grid grid-cols-subgrid items-center gap-x-4 gap-y-1'

export function TheTwoKinds({ sides }: { sides: TheTwoSides | null | undefined }) {
  if (sides === undefined) {
    return (
      <WhileWaiting what="Working out who is owed and who has put money in">
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full" />
          ))}
        </div>
      </WhileWaiting>
    )
  }

  // The page around this has already said it cannot answer. Saying it again under two headings is saying it twice.
  if (sides === null) {
    return null
  }

  return (
    <div className="flex flex-col gap-8">
      <WhoWePay weOwe={sides.weOwe} owedPaisa={sides.owedPaisa} />
      <WhoPutsMoneyIn putIn={sides.putIn} inPaisa={sides.inPaisa} />
    </div>
  )
}

function WhoWePay({ weOwe, owedPaisa }: { weOwe: Array<WeOwe>; owedPaisa: number }) {
  return (
    <section className="flex flex-col gap-3">
      <Heading
        said="Who we pay"
        count={weOwe.length}
        beside={
          <span className="text-muted-foreground text-[0.8125rem]">
            Suppliers and subcontractors · <Figure className="text-brass">{formatPaisa(owedPaisa)}</Figure> owed
          </span>
        }
      />

      {weOwe.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nobody has billed anything yet. A person appears here the first time something is billed against his name.
        </p>
      ) : (
        <TablePanel>
          <div className={GRID}>
            <div
              className={`${ROW} text-muted-foreground border-border hidden border-b px-5 py-2.5 text-[0.75rem] font-semibold sm:grid`}
            >
              <span>Name</span>
              <span>Trade or role</span>
              <span className="text-right">Billed</span>
              <span className="text-right">Paid</span>
              <span className="text-right">Balance owed</span>
            </div>

            <ul className={ROW}>
              {weOwe.map((person) => (
                <li
                  key={person.personId}
                  className={`${ROW} border-border hover:bg-row-hover border-b px-5 py-3 transition-colors last:border-0`}
                >
                  <Link
                    to="/people/$personId"
                    params={{ personId: person.personId }}
                    className="flex min-w-0 items-center gap-3 py-3 -my-3"
                  >
                    <Initials of={person.name} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground truncate font-medium">{person.name}</span>
                      {person.phone === undefined ? null : (
                        <span className="text-muted-foreground truncate text-[0.75rem]">{person.phone}</span>
                      )}
                    </span>
                  </Link>

                  <span className="text-muted-foreground truncate text-sm">{person.doing ?? ''}</span>

                  <Cell said="Billed" tone="text-muted-foreground">
                    {formatPaisa(person.billedPaisa)}
                  </Cell>
                  <Cell said="Paid" tone="text-muted-foreground">
                    {formatPaisa(person.paidPaisa)}
                  </Cell>
                  {/* Brass only where something is owing, as drawn: a balance of nothing is not money going anywhere. */}
                  <Cell
                    said="Balance owed"
                    tone={person.outstandingPaisa > 0 ? 'text-brass font-medium' : 'text-muted-foreground'}
                  >
                    {person.outstandingPaisa < 0
                      ? `${formatPaisa(-person.outstandingPaisa)} adv`
                      : formatPaisa(person.outstandingPaisa)}
                  </Cell>
                </li>
              ))}
            </ul>
          </div>
        </TablePanel>
      )}
    </section>
  )
}

// Cards rather than rows, as drawn. What a man has put in is read as a thing of its own; a balance is read down a column against other balances.

// His card carries a bar and `of X committed` under the figure. **Nothing anywhere holds what anybody committed** -- not on a person, not on a role, and not on any form in his own file, which is what makes it different from the estimate. So the bar and that line are absent rather than empty: a `No commitment set` sentence promises a door, and there is no door.
function WhoPutsMoneyIn({ putIn, inPaisa }: { putIn: Array<PutsMoneyIn>; inPaisa: number }) {
  return (
    <section className="flex flex-col gap-3">
      <Heading
        said="Who puts money in"
        count={putIn.length}
        beside={
          <span className="text-muted-foreground text-[0.8125rem]">
            Partners and clients · <Figure className="text-green">{formatPaisa(inPaisa)}</Figure> received
          </span>
        }
      />

      {putIn.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing has come in yet. A person appears here the first time money arrives from him.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {putIn.map((person) => (
            <li key={person.personId} className="flex">
              <Panel className="hover:border-brass flex w-full transition-colors">
                <Link
                  to="/people/$personId"
                  params={{ personId: person.personId }}
                  className="flex h-full w-full flex-col gap-4 p-5"
                >
                  <span className="flex items-start gap-3">
                    <Initials of={person.name} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-foreground truncate font-medium">{person.name}</span>
                      {person.phone === undefined ? null : (
                        <span className="text-muted-foreground truncate text-[0.75rem]">{person.phone}</span>
                      )}
                    </span>

                    {person.role === undefined ? null : (
                      <Pill
                        tone={person.role === 'partner' ? 'green' : 'brass'}
                        className="ml-auto shrink-0 capitalize"
                      >
                        {person.role}
                      </Pill>
                    )}
                  </span>

                  {/* Green is money coming to the partnership, the same as everywhere else it is shown. */}
                  <Figure className="text-green text-[1.375rem] leading-none">{formatPaisa(person.inPaisa)}</Figure>
                </Link>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Initials({ of }: { of: string }) {
  return (
    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold">
      {initialsOf(of)}
    </span>
  )
}

// The label rides with the figure on a phone, where there is no column heading above it to say what it is.
function Cell({ said, tone, children }: { said: string; tone?: string; children: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 sm:justify-end">
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase sm:hidden">{said}</span>
      <Figure className={`text-right text-sm ${tone ?? 'text-foreground'}`}>{children}</Figure>
    </span>
  )
}
