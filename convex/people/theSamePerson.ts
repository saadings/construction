import { sameName } from '../../shared/validation/person'
import type { Doc } from '../_generated/dataModel'
import type { LedgerMutationCtx } from '../utils/ledgerAccess'

// Three screens each needed to name somebody, so three mutations write to `people`: the people screen, the day sheet, and money coming in. A rule enforced at one of them is a rule about that door rather than about the table, and two rows for one man split his money across both -- every figure about him wrong, and quietly so.

// Read whole rather than through `byName`, because the index answers about the name exactly as typed and the same man is the same man in any case and any spacing.
export async function personAlreadyCalled(
  ctx: Pick<LedgerMutationCtx, 'db'>,
  name: string
): Promise<Doc<'people'> | null> {
  const everyone = await ctx.db.query('people').withIndex('byName').collect()

  return everyone.find((person) => sameName(person.name, name)) ?? null
}
