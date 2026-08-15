import { describe, expect, it } from 'vitest'

import type { BeingTyped, HowPaid } from './payment'
import { HOW_PAID, SAY, asksForBank, asksForChequeNumber, paymentEntry, whatIsMissing } from './payment'

// Ids are only ever read back, never resolved, so any non-empty string stands in for one here.
const A_TRADE = 'js7fjtxt780ycz4cnvcah6et4n8ce272'
const A_PERSON = 'jd792134rzrnxnrvb2w7rvtzfx8cfmjd'
const AN_ACCOUNT = 'jh7abcdefghijklmnopqrstuv8cf000'

function anEntry(over: Record<string, unknown> = {}) {
  return {
    tradeId: A_TRADE,
    day: '2025-10-07',
    amount: '49,150',
    paidToId: A_PERSON,
    paidById: A_PERSON,
    method: 'cheque',
    reference: '0001',
    bankAccountId: AN_ACCOUNT,
    ...over,
  }
}

function beingTyped(over: Partial<BeingTyped> = {}): BeingTyped {
  return {
    tradeId: A_TRADE,
    paidToId: A_PERSON,
    newPerson: '',
    amount: '49,150',
    paidById: A_PERSON,
    method: 'cheque',
    reference: '0001',
    bankAccountId: AN_ACCOUNT,
    note: '',
    ...over,
  }
}

function refusalFor(entry: Record<string, unknown>): string | null {
  const checked = paymentEntry.safeParse(entry)

  return checked.success ? null : (checked.error.issues[0]?.message ?? 'refused without saying why')
}

describe('the questions a way of paying asks', () => {
  // The drift guard. The screen asks from these two functions and the schema refuses from them, so this proves the schema really does what they say.
  it.each(HOW_PAID)('refuses %s for want of a cheque number exactly when the screen asks for one', (method) => {
    const refusal = refusalFor(anEntry({ method, reference: undefined }))

    expect(refusal === SAY.reference).toBe(asksForChequeNumber(method))
  })

  it.each(HOW_PAID)('refuses %s for want of an account exactly when the screen asks for one', (method) => {
    const refusal = refusalFor(anEntry({ method, bankAccountId: undefined }))

    expect(refusal === SAY.bank).toBe(asksForBank(method))
  })

  it.each(HOW_PAID)('lets %s through when everything it asks for is there', (method) => {
    expect(refusalFor(anEntry({ method }))).toBeNull()
  })

  it('asks nothing extra of cash, and everything of a cheque', () => {
    // The control: the three tests above would all pass if both functions always returned false.
    expect(asksForChequeNumber('cheque')).toBe(true)
    expect(asksForBank('cheque')).toBe(true)
    expect(asksForChequeNumber('cash')).toBe(false)
    expect(asksForBank('cash')).toBe(false)
  })
})

describe('what is missing, as it is typed', () => {
  it('says nothing when a payment is finished', () => {
    expect(whatIsMissing(beingTyped())).toBeNull()
  })

  it.each([
    [{ tradeId: '' }, SAY.trade],
    [{ paidToId: '', newPerson: '  ' }, SAY.paidTo],
    [{ amount: '' }, SAY.amount],
    [{ paidById: '' }, SAY.paidBy],
    [{ reference: '' }, SAY.reference],
    [{ bankAccountId: '' }, SAY.bank],
  ] as Array<[Partial<BeingTyped>, string]>)('says %o is missing', (missing, said) => {
    expect(whatIsMissing(beingTyped(missing))).toBe(said)
  })

  it('says the same words the server would', () => {
    // The other half of the drift guard: a message the screen shows must be one the server would also have said.
    const said = whatIsMissing(beingTyped({ reference: '' }))
    const refused = refusalFor(anEntry({ reference: undefined }))

    expect(said).toBe(refused)
  })

  it('stops asking for a cheque number the moment it is paid in cash', () => {
    const inCash: HowPaid = 'cash'

    expect(whatIsMissing(beingTyped({ method: inCash, reference: '', bankAccountId: '' }))).toBeNull()
  })
})
