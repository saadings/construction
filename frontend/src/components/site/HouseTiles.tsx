import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Tile } from '../shell/Panel'

// The four figures the drawing puts across the top of a house: what has gone out against what it was expected to cost, what is left of that, what has come in against what was agreed, and what the difference between those two comes to.

// Every one is read off a query the app already answers. Nothing here adds anything up that a screen elsewhere adds up differently.
export type WhatTheHouseComesTo = {
  spentPaisa: number
  receivedPaisa: number
  /** What the build was expected to cost. Absent until somebody has said, which is not the same as nothing. */
  budgetEstimatePaisa?: number
  /** What the client agreed to pay. `null` on a house the partnership is building to sell, which has no client and no contract. */
  contractPaisa: number | null
}

/** How much of the estimate has gone, as a share somebody would say out loud. */
export function shareOfTheEstimate(spentPaisa: number, estimatePaisa: number): number {
  if (estimatePaisa <= 0 || spentPaisa <= 0) {
    return 0
  }

  return Math.round((spentPaisa / estimatePaisa) * 100)
}

export function HouseTiles({ what }: { what: WhatTheHouseComesTo }) {
  const estimate = what.budgetEstimatePaisa

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Brass is money that has gone out, the same as everywhere else it is shown. */}
      <Tile
        label="Spent so far"
        tone="text-brass"
        beneath={estimate === undefined ? 'No estimate set for this house.' : `Estimate ${formatPaisa(estimate)}`}
      >
        <Figure>{formatPaisa(what.spentPaisa)}</Figure>
      </Tile>

      <LeftInTheEstimate spentPaisa={what.spentPaisa} estimatePaisa={estimate} />

      {/* Green is money coming to the partnership rather than leaving it. */}
      <Tile
        label="Received"
        tone="text-green"
        beneath={
          what.contractPaisa === null
            ? 'No contract: this house is the partnership’s own to sell.'
            : `Contract ${formatPaisa(what.contractPaisa)}`
        }
      >
        <Figure>{formatPaisa(what.receivedPaisa)}</Figure>
      </Tile>

      <ExpectedMargin contractPaisa={what.contractPaisa} estimatePaisa={estimate} />
    </dl>
  )
}

// What is left of the estimate. A house nobody has estimated has an unanswered question rather than a figure of nothing, so the tile says which -- the same sentence the card on the houses screen puts where its bar goes.
function LeftInTheEstimate({ spentPaisa, estimatePaisa }: { spentPaisa: number; estimatePaisa?: number }) {
  if (estimatePaisa === undefined) {
    return (
      <Tile label="Left in estimate" tone="text-muted-foreground" beneath="Put an estimate on this house to see this.">
        <Figure>—</Figure>
      </Tile>
    )
  }

  const left = estimatePaisa - spentPaisa
  const share = shareOfTheEstimate(spentPaisa, estimatePaisa)

  return (
    <Tile
      label={left < 0 ? 'Over the estimate by' : 'Left in estimate'}
      // Red only where it has gone past, because that is the one state on this screen somebody has to act on.
      tone={left < 0 ? 'text-destructive' : undefined}
      beneath={`${String(share)}% of the estimate used`}
    >
      <Figure>{formatPaisa(Math.abs(left))}</Figure>
    </Tile>
  )
}

// Contract less estimate, which is a question about a house somebody is paying for. On the partnership's own house there is no contract, so the question does not arise and the tile is not drawn.

// Absent rather than a dash: `Left in estimate` says what is missing because *what did we expect this to cost* is a question about every house. This one is not, and a tile saying `No contract set` would invent a gap and invite somebody to fill it where filling it would be wrong.
function ExpectedMargin({ contractPaisa, estimatePaisa }: { contractPaisa: number | null; estimatePaisa?: number }) {
  if (contractPaisa === null) {
    return null
  }

  if (estimatePaisa === undefined) {
    return (
      <Tile label="Expected margin" tone="text-muted-foreground" beneath="Needs an estimate as well as the contract.">
        <Figure>—</Figure>
      </Tile>
    )
  }

  const margin = contractPaisa - estimatePaisa

  return (
    <Tile
      label={margin < 0 ? 'Expected loss' : 'Expected margin'}
      tone={margin < 0 ? 'text-destructive' : undefined}
      beneath="Contract less estimate"
    >
      <Figure>{formatPaisa(Math.abs(margin))}</Figure>
    </Tile>
  )
}
