import { formatPaisa } from '~shared/money'

import { NotKnownHere } from '../shell/NotKnownHere'
import { Figure, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type AccountLine = {
  what: 'billed' | 'paid'
  day: string
  amountPaisa: number
  id: string
  balancePaisa: number
  onWhichHouse: string
  said?: string
}

export type Account = {
  name: string
  phone?: string
  lines: Array<AccountLine>
  billedPaisa: number
  paidPaisa: number
}

// The same markup at every width. A phone gets what happened and the balance after it; a desk gets the house and the two columns between them as well.

// One grid for the whole list, and every row takes its columns from it. Written per row, each row sized its own `auto` track to its own content -- three rows put `Balance` at 364 and one at 377, two figures of the same digit count -- the track was sizing to the *other* cell in the row.
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[7rem_minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]'

/** A row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

/** Everything between the grid and a row -- a list, a list item -- which has to pass the columns down rather than stop them. */
const PASSES_THEM_DOWN = 'col-span-full grid grid-cols-subgrid'

// Somebody's account, the way the `MR FARAN ACCOUNT` sheet reads: everything they have billed, everything they have been paid, and the balance after each line.

// It spans every house, because that is how the debt works. Two half-balances on two houses is a figure nobody can act on.

// Three different unknowns, kept apart: still coming, a sign-in the ledger has never seen, and nobody by this name. Folding any two of them together is a screen watching for something that is not on its way.
export function TheirAccount({ answer }: { answer: { account: Account | null } | null | undefined }) {
  if (answer === undefined) {
    return (
      <Page title="Their account">
        <AccountWaiting />
      </Page>
    )
  }

  if (answer === null) {
    return (
      <Page title="Their account">
        <NotKnownHere />
      </Page>
    )
  }

  const account = answer.account

  // The ledger has answered and has nobody by this name -- a link followed after somebody was taken off the list. A statement of zeroes would be a screen claiming a fact about a person who is not there.
  if (account === null) {
    return (
      <Page title="Their account">
        <p className="text-muted-foreground max-w-prose">
          Nobody by that name is in the list any more. They may have been taken off it.
        </p>
      </Page>
    )
  }

  const standing = account.billedPaisa - account.paidPaisa

  return (
    <Page
      title={account.name}
      beside={
        account.phone === undefined ? undefined : <span className="text-muted-foreground text-sm">{account.phone}</span>
      }
    >
      <Standing standing={standing} account={account} />

      {account.lines.length === 0 ? (
        <p className="text-muted-foreground py-6">
          Nothing on this account yet. Bills raised against them and payments made to them both land here.
        </p>
      ) : (
        <div className={GRID}>
          <div
            className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
          >
            <span>Day</span>
            <span>What for</span>
            <span className="text-right">Billed</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Balance</span>
          </div>

          <ul className={`${PASSES_THEM_DOWN} divide-hairline divide-y`}>
            {account.lines.map((line) => (
              <AccountRow key={line.id} line={line} />
            ))}
          </ul>
        </div>
      )}
    </Page>
  )
}

// The two sides and what is left, said in words rather than left as a sign somebody has to notice. An advance is a real position in these books -- `ADV` and `BL PMT` are all over the workbooks -- so it reads as one rather than as a minus.
function Standing({ standing, account }: { standing: number; account: Account }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
        <Sum label="Billed">{formatPaisa(account.billedPaisa)}</Sum>
        <Sum label="Paid" tone="text-brass">
          {formatPaisa(account.paidPaisa)}
        </Sum>
      </div>

      <p className="text-foreground text-lg">
        {standing === 0 ? (
          'Nothing outstanding either way.'
        ) : standing > 0 ? (
          <>
            Owed <Figure className="text-green">{formatPaisa(standing)}</Figure>
          </>
        ) : (
          <>
            Holding <Figure className="text-green">{formatPaisa(-standing)}</Figure> in advance
          </>
        )}
      </p>
    </section>
  )
}

function AccountRow({ line }: { line: AccountLine }) {
  const billed = line.what === 'billed'

  return (
    <li className={`${ROW} py-3.5`}>
      <span className="text-muted-foreground order-last col-span-2 text-sm sm:order-none sm:col-span-1">
        {line.day}
      </span>

      <span className="min-w-0">
        <span className="text-foreground block truncate text-[0.9375rem]">{line.onWhichHouse}</span>
        {line.said === undefined ? null : (
          <span className="text-muted-foreground block truncate text-sm">{line.said}</span>
        )}
      </span>

      {/* Billed and paid stay in their own columns rather than sharing one with a sign, because a column somebody runs a finger down cannot mean two things. */}
      <Cell label="Billed">{billed ? formatPaisa(line.amountPaisa) : ''}</Cell>
      <Cell label="Paid" tone="text-brass">
        {billed ? '' : formatPaisa(line.amountPaisa)}
      </Cell>
      <Cell label="Balance" tone={line.balancePaisa < 0 ? 'text-green' : 'text-foreground'}>
        {line.balancePaisa < 0 ? `${formatPaisa(-line.balancePaisa)} adv` : formatPaisa(line.balancePaisa)}
      </Cell>
    </li>
  )
}

// The label rides with the figure on a phone, where there is no column heading above it to say what it is. An empty cell says nothing at all rather than a label with nothing after it.
function Cell({ label, tone, children }: { label: string; tone?: string; children: string }) {
  if (children === '') {
    return <span className="hidden sm:block" />
  }

  return (
    <span className="flex items-baseline justify-between gap-2 sm:justify-end">
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase sm:hidden">{label}</span>
      <Figure className={`${tone ?? 'text-foreground'} text-right`}>{children}</Figure>
    </span>
  )
}

function Sum({ label, tone, children }: { label: string; tone?: string; children: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-faint text-[0.6875rem] tracking-[0.06em] uppercase">{label}</span>
      <Figure className={`${tone ?? 'text-foreground'} text-xl`}>{children}</Figure>
    </div>
  )
}

// The shape of what is coming: the two sums, then the statement under them.
function AccountWaiting() {
  return (
    <WhileWaiting what="Getting their account">
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        {[0, 1].map((sum) => (
          <div key={sum} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>

      <div className="divide-hairline flex flex-col divide-y">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-baseline justify-between gap-4 py-3.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </WhileWaiting>
  )
}
