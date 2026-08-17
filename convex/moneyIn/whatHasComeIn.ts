import type { WhyItCame } from '../../shared/validation/moneyIn'
import { WHY_IT_CAME } from '../../shared/validation/moneyIn'

// The sums and the order, worked out once. One house reads them and so does the screen over every house, and two copies of this arithmetic is how a tile and a table come to disagree about a figure he is looking at twice -- which is the reason `thePosition` exists next door.

export type Split = Record<WhyItCame, number>

/** What has come in, split by what kind of money it is. */
export function splitByWhy(receipts: Array<{ why: WhyItCame; amountPaisa: number }>): {
  byWhy: Split
  receivedPaisa: number
} {
  // Started from the list of reasons rather than from the rows, so a reason nothing has come in under reads as zero instead of going missing.
  const byWhy = Object.fromEntries(WHY_IT_CAME.map((why) => [why, 0])) as Split

  for (const receipt of receipts) {
    byWhy[receipt.why] += receipt.amountPaisa
  }

  return {
    byWhy,
    // Not a fourth sum: the three above are every receipt, split three ways, and this says so out loud.
    receivedPaisa: byWhy.partnerMoney + byWhy.clientPayment + byWhy.sale,
  }
}

// The day carries no time, and a cheque run puts several receipts on one day. What separates them is written down rather than left to whichever order the rows came back in, so the list reads the same twice.

/** Newest first, then largest, then the name; the id settles the rest. */
export function newestFirst(
  one: { day: string; amountPaisa: number; fromName: string; _id: string },
  other: { day: string; amountPaisa: number; fromName: string; _id: string }
): number {
  return (
    other.day.localeCompare(one.day) ||
    other.amountPaisa - one.amountPaisa ||
    one.fromName.localeCompare(other.fromName) ||
    one._id.localeCompare(other._id)
  )
}
