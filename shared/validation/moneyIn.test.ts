import { describe, expect, it } from 'vitest'

import { HOW_PAID, asksForBank, asksForChequeNumber } from './howMoneyMoved'
import { SAY_IN, receiptInput } from './moneyIn'
import { paymentEntry } from './payment'

// Ids are only ever read back, never resolved, so any non-empty string stands in for one here.
const A_PERSON = 'jd792134rzrnxnrvb2w7rvtzfx8cfmjd'
const AN_ACCOUNT = 'jh7abcdefghijklmnopqrstuv8cf000'
const A_TRADE = 'js7fjtxt780ycz4cnvcah6et4n8ce272'

function aReceipt(over: Record<string, unknown> = {}) {
  return {
    day: '2025-10-07',
    amount: '2,500,000',
    fromId: A_PERSON,
    why: 'partnerMoney' as const,
    method: 'cheque' as const,
    reference: '0001',
    bankAccountId: AN_ACCOUNT,
    ...over,
  }
}

function refusalFrom(input: Record<string, unknown>): string | null {
  const result = receiptInput.safeParse(input)
  return result.success ? null : (result.error.issues[0]?.message ?? 'refused without saying why')
}

describe('money coming in', () => {
  it('stores rupees as whole paisa', () => {
    const parsed = receiptInput.parse(aReceipt({ amount: '2,500,000.50' }))

    expect(parsed.amount).toBe(250000050)
    expect(parsed.day).toBe('2025-10-07')
  })

  // The four ways money moves ask the same questions in both directions. These two run the receipt rules through the same table the day sheet is refused by, so forking that table breaks one of them.
  it.each(HOW_PAID)('refuses %s for want of a cheque number exactly when the way it moved asks for one', (method) => {
    const refusal = refusalFrom(aReceipt({ method, reference: undefined }))

    expect(refusal === SAY_IN.reference).toBe(asksForChequeNumber(method))
  })

  it.each(HOW_PAID)('refuses %s for want of an account exactly when the way it moved asks for one', (method) => {
    const refusal = refusalFrom(aReceipt({ method, bankAccountId: undefined }))

    expect(refusal === SAY_IN.bank).toBe(asksForBank(method))
  })

  // Both flows read one table, so what one asks for the other asks for. If this ever disagrees, two copies of the rule have grown.
  it.each(HOW_PAID)('asks %s the same questions coming in as going out', (method) => {
    const outgoing = paymentEntry.safeParse({
      tradeId: A_TRADE,
      day: '2025-10-07',
      amount: '2,500,000',
      paidToId: A_PERSON,
      paidById: A_PERSON,
      method,
    })
    const incoming = receiptInput.safeParse(aReceipt({ method, reference: undefined, bankAccountId: undefined }))

    expect(incoming.success).toBe(outgoing.success)
  })

  it('will not take money from nobody', () => {
    expect(refusalFrom(aReceipt({ fromId: undefined }))).toBe(SAY_IN.from)
  })

  // A buyer at the sale is nobody in the ledger until the day he pays.
  it('takes a name typed once instead of somebody already known', () => {
    const parsed = receiptInput.parse(aReceipt({ fromId: undefined, newPerson: '  Who   bought it ', why: 'sale' }))

    expect(parsed.newPerson).toBe('Who bought it')
    expect(parsed.why).toBe('sale')
  })

  it('will not take money that has not come in yet', () => {
    expect(refusalFrom(aReceipt({ day: '2099-01-01' }))).toBe('Pick a day that has already happened.')
  })
})
