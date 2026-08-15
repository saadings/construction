import { contractValuePaisa } from '../../shared/validation/contract'
import { siteQuery } from '../utils/siteAccess'

// The contract on this house, with its value worked out rather than read: a rate contract has no total stored anywhere.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const contracts = await ctx.db
      .query('contracts')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const agreed = contracts.find((one) => !one.hidden)
    if (agreed === undefined) {
      return null
    }

    return { ...agreed, valuePaisa: contractValuePaisa(agreed) }
  },
})
