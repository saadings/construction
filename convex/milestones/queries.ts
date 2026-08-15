import { contractValuePaisa } from '../../shared/validation/contract'
import { milestoneAmountPaisa, percentAgreedSoFar } from '../../shared/validation/milestone'
import { siteQuery } from '../utils/siteAccess'

// The stages of this house's contract, each with the figure it comes to. None of those figures is stored: they follow the contract, which follows the measured area.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const contracts = await ctx.db
      .query('contracts')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const contract = contracts.find((one) => !one.hidden)
    if (contract === undefined) {
      return null
    }

    const stages = (
      await ctx.db
        .query('milestones')
        .withIndex('byContract', (q) => q.eq('contractId', contract._id))
        .collect()
    )
      .filter((stage) => !stage.hidden)
      .sort((one, other) => one.position - other.position)

    const valuePaisa = contractValuePaisa(contract)

    return {
      contractValuePaisa: valuePaisa,
      // Shown so a person can see it is not a hundred, never enforced: a re-measurement or an unplanned stage leaves real contracts adding to something else.
      percentAgreed: percentAgreedSoFar(stages),
      stages: stages.map((stage) => ({
        ...stage,
        amountPaisa: milestoneAmountPaisa(valuePaisa, stage.percent),
      })),
    }
  },
})
