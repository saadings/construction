import { rupeesToPaisa } from '~shared/money'

import type { Id } from '../../../../convex/_generated/dataModel'

// What one payment looks like while it is being typed. Every answer a string, because that is what a half-filled form holds.

// Ids keep the table they belong to even while empty, so a picker cannot hand a person's id to the question asking for a trade.
export type Draft = {
  tradeId: Id<'trades'> | ''
  paidToId: Id<'people'> | ''
  newPerson: string
  amount: string
  paidById: Id<'people'> | ''
  method: 'cheque' | 'cash' | 'transfer' | 'payOrder'
  reference: string
  bankAccountId: Id<'bankAccounts'> | ''
  note: string
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
    paidById: '',
    method: 'cheque',
    reference: '',
    bankAccountId: '',
    note: '',
    ...keeping,
  }
}

export const HOW_PAID = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'payOrder', label: 'Pay order' },
] as const

// Which questions this way of paying actually asks. A form asking eight when four apply is how a day sheet turns back into a spreadsheet.
export function asksForChequeNumber(method: Draft['method']): boolean {
  return method === 'cheque'
}

export function asksForBank(method: Draft['method']): boolean {
  // A pay order can be bought over the counter with cash, so it is not asked either.
  return method === 'cheque' || method === 'transfer'
}

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

// Said in the words a person would use, and never listing more than the first thing wrong: eight problems at once reads as the app being broken.
export function whatIsMissing(draft: Draft): string | null {
  if (!draft.tradeId) return 'Pick what this was for.'
  if (!draft.paidToId && !draft.newPerson.trim()) return 'Say who was paid.'
  if (paisaIn(draft) === 0) return 'Put in how much was paid.'
  if (!draft.paidById) return 'Say whose money this was.'
  if (asksForChequeNumber(draft.method) && !draft.reference.trim()) return 'Add the cheque number.'
  if (asksForBank(draft.method) && !draft.bankAccountId) return 'Say which account this left.'

  return null
}

// Only what the server takes. Anything a way of paying does not ask for is left off rather than sent empty.
export function asAnEntry(draft: Draft, day: string) {
  if (draft.tradeId === '' || draft.paidById === '') {
    // Cannot be reached: `whatIsMissing` refuses this first. Named out loud rather than asserted away, so the type stays honest about what a half-filled draft holds.
    throw new Error('a payment was sent before it was finished')
  }

  return {
    tradeId: draft.tradeId,
    day,
    amount: draft.amount,
    paidToId: draft.paidToId || undefined,
    newPerson: draft.paidToId ? undefined : draft.newPerson.trim(),
    paidById: draft.paidById,
    method: draft.method,
    reference: asksForChequeNumber(draft.method) ? draft.reference.trim() : undefined,
    bankAccountId: (asksForBank(draft.method) ? draft.bankAccountId : '') || undefined,
    note: draft.note.trim() || undefined,
  }
}
