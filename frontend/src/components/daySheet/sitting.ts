import { rupeesToPaisa } from '~shared/money'
import type { HowPaid } from '~shared/validation/howMoneyMoved'
import { asksForBank, asksForChequeNumber } from '~shared/validation/howMoneyMoved'
import type { BeingTyped } from '~shared/validation/payment'
import { whatIsMissing } from '~shared/validation/payment'

import type { Id } from '../../../../convex/_generated/dataModel'

// Which questions each way of paying asks, and the words for what is missing, come from the files the server refuses by. Restating either here is how two copies of one rule drift into disagreeing.
export { asksForBank, asksForChequeNumber, whatIsMissing }
export type { HowPaid }

// The same shape those rules read, with ids that keep the table they belong to so a picker cannot hand a person's id to the question asking for a trade.
export type Draft = BeingTyped & {
  tradeId: Id<'trades'> | ''
  paidToId: Id<'people'> | ''
  bankAccountId: Id<'bankAccounts'> | ''
}

// A picker hands back plain text, so the answer is looked up in the list it was drawn from rather than trusted to be an id: nothing unknown gets through, which asserting a type would not promise.
export function pickedFrom<TRow extends { _id: string }>(rows: Array<TRow>, chosen: string): TRow['_id'] | '' {
  return rows.find((row) => row._id === chosen)?._id ?? ''
}

// The site and the day are chosen once and stay. Only these change from one payment to the next.
export function anEmptyDraft(keeping: Partial<Draft> = {}): Draft {
  return {
    tradeId: '',
    paidToId: '',
    newPerson: '',
    amount: '',
    method: 'cheque',
    reference: '',
    bankAccountId: '',
    note: '',
    ...keeping,
  }
}

// The words on the buttons. The values themselves are the schema's, so a new way of paying cannot appear here without existing there.
export const HOW_PAID: Array<{ value: HowPaid; label: string }> = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'payOrder', label: 'Pay order' },
]

export function paisaIn(draft: Draft): number {
  try {
    return rupeesToPaisa(draft.amount)
  } catch {
    return 0
  }
}

export function sittingTotalPaisa(drafts: Array<Draft>): number {
  return drafts.reduce((total, draft) => total + paisaIn(draft), 0)
}

// Only what the server takes. Anything a way of paying does not ask for is left off rather than sent empty.
export function asAnEntry(draft: Draft, day: string) {
  if (draft.tradeId === '') {
    // Cannot be reached: `whatIsMissing` refuses this first. Named out loud rather than asserted away, so the type stays honest about what a half-filled draft holds.
    throw new Error('a payment was sent before it was finished')
  }

  return {
    tradeId: draft.tradeId,
    day,
    amount: draft.amount,
    paidToId: draft.paidToId || undefined,
    newPerson: draft.paidToId ? undefined : draft.newPerson.trim(),
    method: draft.method,
    reference: asksForChequeNumber(draft.method) ? draft.reference.trim() : undefined,
    bankAccountId: (asksForBank(draft.method) ? draft.bankAccountId : '') || undefined,
    note: draft.note.trim() || undefined,
  }
}
