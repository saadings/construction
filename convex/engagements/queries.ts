import { siteQuery } from '../utils/siteAccess'

// Three figures for every person on a trade, and all three are needed. Akram: agreed 300,000, billed 340,000 once extra work landed, paid 325,000.

// Agreed against billed is what the 199-M sheet calls "due to extra work or redoing". Billed against paid is the balance. Neither can be worked out from one figure.
export const spread = siteQuery({
  handler: async (ctx) => {
    const engagements = await ctx.db
      .query('engagements')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const [bills, payments] = await Promise.all([
      ctx.db
        .query('bills')
        .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
        .collect(),
      ctx.db
        .query('payments')
        .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
        .collect(),
    ])

    const spread = []
    for (const engagement of engagements) {
      if (engagement.hidden) continue

      const person = await ctx.db.get('people', engagement.personId)
      const trade = await ctx.db.get('trades', engagement.tradeId)

      // Matched on the person and the trade, which is what an engagement is. A bill or a payment with no engagement behind it still counts on the person's account; it simply has no agreed figure to be measured against.
      const onThis = (row: { personId?: string; paidToId?: string; tradeId: string; removed: boolean }) =>
        !row.removed && (row.personId ?? row.paidToId) === engagement.personId && row.tradeId === engagement.tradeId

      spread.push({
        engagementId: engagement._id,
        personName: person?.name ?? 'Someone no longer listed',
        tradeName: trade?.name ?? 'A trade no longer listed',
        agreedPaisa: engagement.agreedPaisa,
        ratePaisa: engagement.ratePaisa,
        unit: engagement.unit,
        billedPaisa: bills.filter(onThis).reduce((total, bill) => total + bill.amountPaisa, 0),
        paidPaisa: payments.filter(onThis).reduce((total, payment) => total + payment.amountPaisa, 0),
      })
    }

    return spread
  },
})
