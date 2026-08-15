// A share is basis points of a whole, never a percentage in a float: 33.33% is 3333, and 3333 + 3333 + 3334 is the whole exactly. A third of a rupee as a float is not a third of a rupee.
export const THE_WHOLE = 10_000

export type Share = { personId: string; basisPoints: number }
export type Put = { personId: string; paisa: number }

// What each partner would have if the split followed what each of them put in. It is the default, and it is only a default: Nauman asked twice for it to be customisable, because who put the money in is not always who agreed to take the profit.
export function proportionalTo(capital: Array<Put>): Array<Share> {
  const total = capital.reduce((sum, put) => sum + put.paisa, 0)

  // Nobody has put anything in yet, so there is nothing to be proportional to. An even split would be an answer nobody agreed.
  if (total <= 0) {
    return []
  }

  const shares = capital.map((put) => ({
    personId: put.personId,
    basisPoints: Math.floor((put.paisa * THE_WHOLE) / total),
  }))

  return giveTheRemainderAway(shares, THE_WHOLE, capital)
}

// Money split by a share, in whole paisa, adding back up to exactly what was split. Every part is rounded down and the remainder is handed to one of them on purpose, because paisa that vanish in rounding are paisa somebody is owed.
export function shareOut(paisa: number, shares: Array<Share>): Array<Put> {
  const declared = shares.reduce((sum, share) => sum + share.basisPoints, 0)

  if (declared <= 0 || paisa <= 0) {
    return shares.map((share) => ({ personId: share.personId, paisa: 0 }))
  }

  const parts = shares.map((share) => ({
    personId: share.personId,
    paisa: Math.floor((paisa * share.basisPoints) / declared),
  }))

  const short = paisa - parts.reduce((sum, part) => sum + part.paisa, 0)

  return handOver(parts, short, shares)
}

// The largest share takes what is left over, and two of the same size are settled by name. Written down rather than left to whichever came back first, so the same figures split the same way twice.
function handOver(parts: Array<Put>, short: number, shares: Array<Share>): Array<Put> {
  if (short === 0 || parts.length === 0) {
    return parts
  }

  const biggest = [...shares].sort(
    (one, other) => other.basisPoints - one.basisPoints || one.personId.localeCompare(other.personId)
  )[0]

  return parts.map((part) => (part.personId === biggest.personId ? { ...part, paisa: part.paisa + short } : part))
}

function giveTheRemainderAway(shares: Array<Share>, whole: number, capital: Array<Put>): Array<Share> {
  const short = whole - shares.reduce((sum, share) => sum + share.basisPoints, 0)
  if (short === 0) {
    return shares
  }

  // Whoever put the most in takes the odd basis point, settled by name when two put in the same.
  const biggest = [...capital].sort(
    (one, other) => other.paisa - one.paisa || one.personId.localeCompare(other.personId)
  )[0]

  return shares.map((share) =>
    share.personId === biggest.personId ? { ...share, basisPoints: share.basisPoints + short } : share
  )
}
