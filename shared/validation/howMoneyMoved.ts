export const HOW_PAID = ['cheque', 'cash', 'transfer', 'payOrder'] as const
export type HowPaid = (typeof HOW_PAID)[number]

// Which questions a way of moving money actually asks, stated once: the screen asks from this, the schema refuses from this, and a test holds them to each other.

// The same four ways carry money out to a mason and in from a client, and they ask the same questions in both directions, so the rule sits above either flow rather than inside one of them.

// A pay order can be bought over the counter with cash, so it may have no account behind it and no cheque book number either.
const ASKS: Record<HowPaid, { chequeNumber: boolean; bank: boolean }> = {
  cheque: { chequeNumber: true, bank: true },
  transfer: { chequeNumber: false, bank: true },
  cash: { chequeNumber: false, bank: false },
  payOrder: { chequeNumber: false, bank: false },
}

export function asksForChequeNumber(method: HowPaid): boolean {
  return ASKS[method].chequeNumber
}

export function asksForBank(method: HowPaid): boolean {
  return ASKS[method].bank
}
